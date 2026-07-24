// Calls the Ollama instance on the Hetzner box. Ollama there only runs inside a
// scheduled 22:00-06:00 UTC off-peak window (no GPU on the server) — callers of
// this module must only run from within that window (see scripts/analyze-reports.ts,
// which is invoked exclusively by a PM2 cron job scheduled inside it).

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:14b";

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

export async function analyzeReportText(
  companyName: string,
  fiscalYear: number,
  reportText: string
): Promise<ReportMetrics> {
  const truncated = reportText.slice(0, 24000);

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: METRICS_SCHEMA,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Company: ${companyName}\nFiscal year: ${fiscalYear}\n\nReport excerpt:\n${truncated}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { message: { content: string } };
  const parsed = JSON.parse(data.message.content) as ReportMetrics;
  return parsed;
}

const NARRATE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "highlights"],
} as const;

// For EDGAR filings the numbers come straight from XBRL (accurate, no LLM
// needed) — this call only asks the model to turn already-known figures into
// plain language, which is a much smaller/faster prompt than full extraction.
export async function narrateMetrics(
  companyName: string,
  fiscalYear: number,
  metrics: Record<string, number | null>
): Promise<Pick<ReportMetrics, "summary" | "highlights">> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: NARRATE_SCHEMA,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Company: ${companyName}\nFiscal year: ${fiscalYear}\n\nKnown figures (JSON, original currency, null = not disclosed):\n${JSON.stringify(metrics)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { message: { content: string } };
  return JSON.parse(data.message.content);
}

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
