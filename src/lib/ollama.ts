// Calls the Ollama instance on the Hetzner box. Ollama there only runs inside a
// scheduled 22:00-06:00 UTC off-peak window (no GPU on the server) — callers of
// this module must only run from within that window (see scripts/analyze-reports.ts,
// which is invoked exclusively by a PM2 cron job scheduled inside it).
//
// Every request streams (`stream: true`). This is not about consuming tokens
// incrementally — we buffer the whole thing anyway — it is the only way to keep
// the request alive. With `stream: false` Ollama withholds the response headers
// until generation is completely finished, and Node's undici applies a 300s
// `headersTimeout` to that wait; on this CPU-only box a 14b model routinely
// takes longer than that, so every single call died with `TypeError: fetch
// failed` at exactly 5m00s. Streaming makes the headers arrive with the first
// token, so the only limit left is the explicit budget below.

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

// Wall-clock ceiling for a single generation. Generous by design: it is a
// backstop against a wedged model, not a latency target.
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 20 * 60_000);

export class OllamaTimeoutError extends Error {
  constructor(ms: number) {
    super(`Ollama did not finish within ${Math.round(ms / 1000)}s`);
    this.name = "OllamaTimeoutError";
  }
}

export class OllamaRequestError extends Error {
  constructor(status: number, body: string) {
    super(`Ollama request failed: ${status} ${body}`);
    this.name = "OllamaRequestError";
  }
}

export interface ReportMetrics {
  revenue: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  eps: number | null;
  revenueGrowthPct: number | null;
  profitMarginPct: number | null;
  summary: string;
  highlights: string[];
}

const METRICS_SCHEMA = {
  type: "object",
  properties: {
    revenue: { type: ["number", "null"] },
    netIncome: { type: ["number", "null"] },
    totalAssets: { type: ["number", "null"] },
    totalLiabilities: { type: ["number", "null"] },
    eps: { type: ["number", "null"] },
    revenueGrowthPct: { type: ["number", "null"] },
    profitMarginPct: { type: ["number", "null"] },
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "highlights"],
} as const;

const SYSTEM_PROMPT = `You are a financial analyst. You read excerpts of corporate annual/quarterly
reports and extract structured figures plus a short plain-language summary for a general audience.
Figures are in the report's original currency and units, expressed as plain numbers (no thousands
separators, no currency symbols). If a figure is not present in the text, use null. Keep "summary"
to 2-3 sentences, no jargon. "highlights" is 3-5 short bullet strings, each one concrete fact.`;

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface StreamChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

// Posts a chat completion constrained to `format`, streams the reply back, and
// parses the accumulated content as JSON. Shared by both public helpers below —
// they differ only in schema and prompt.
async function chatJson<T>(format: object, messages: ChatMessage[]): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, stream: true, format, messages }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new OllamaTimeoutError(OLLAMA_TIMEOUT_MS);
    }
    throw err;
  }

  if (!res.ok) throw new OllamaRequestError(res.status, await res.text());
  if (!res.body) throw new OllamaRequestError(res.status, "empty response body");

  // Ollama streams newline-delimited JSON. Chunk boundaries do not respect line
  // boundaries, so hold the trailing partial line over to the next read.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as StreamChunk;
        if (chunk.error) throw new OllamaRequestError(200, chunk.error);
        content += chunk.message?.content ?? "";
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new OllamaTimeoutError(OLLAMA_TIMEOUT_MS);
    }
    throw err;
  } finally {
    reader.releaseLock();
  }

  if (buffer.trim()) {
    const chunk = JSON.parse(buffer) as StreamChunk;
    content += chunk.message?.content ?? "";
  }

  return JSON.parse(content) as T;
}

export async function analyzeReportText(
  companyName: string,
  fiscalYear: number,
  reportText: string
): Promise<ReportMetrics> {
  const truncated = reportText.slice(0, 24000);

  return chatJson<ReportMetrics>(METRICS_SCHEMA, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Company: ${companyName}\nFiscal year: ${fiscalYear}\n\nReport excerpt:\n${truncated}`,
    },
  ]);
}

const NARRATE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "highlights"],
} as const;

// For filings ingested from a structured source (SEC XBRL, Yahoo fundamentals)
// the numbers are already exact — this call only asks the model to turn known
// figures into plain language, a much smaller/faster prompt than full extraction.
export async function narrateMetrics(
  companyName: string,
  fiscalYear: number,
  metrics: Record<string, number | null>,
  currency?: string | null
): Promise<Pick<ReportMetrics, "summary" | "highlights">> {
  const currencyNote = currency
    ? `\nAll monetary figures are in ${currency}. Refer to that currency by name where it reads naturally.`
    : "";

  // Small models reliably mis-scale these: a 3b test turned NVIDIA's
  // 60922000000 into "$60,922 billion". Spelling out the magnitudes costs a few
  // tokens and removes the whole class of error.
  const scaleNote = `\nFigures are absolute amounts, not thousands or millions: 60922000000 is 60.9 billion, 1500000 is 1.5 million. Restate them at the correct magnitude.`;

  return chatJson<Pick<ReportMetrics, "summary" | "highlights">>(NARRATE_SCHEMA, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Company: ${companyName}\nFiscal year: ${fiscalYear}${currencyNote}${scaleNote}\n\nKnown figures (JSON, original currency, null = not disclosed):\n${JSON.stringify(metrics)}`,
    },
  ]);
}

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
