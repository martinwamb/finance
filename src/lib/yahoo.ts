// Annual fundamentals for companies outside SEC EDGAR's reach — Europe and Asia.
//
// Uses Yahoo's `fundamentals-timeseries` endpoint, which needs no API key and
// no crumb/cookie dance (unlike `quoteSummary`, which returns 401 Invalid Crumb
// without one). It is undocumented, so everything here parses defensively: a
// shape change must fail one company, not abort the whole ingest run.

import { z } from "zod";
import { deriveMetrics, type FiscalYearMetrics } from "./fundamentals";

const BASE = "https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries";

// Yahoo rejects requests carrying Node's default user agent.
const USER_AGENT =
  process.env.YAHOO_USER_AGENT ??
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Yahoo's field names for the figures the Insight model stores.
const SERIES = {
  revenue: "annualTotalRevenue",
  netIncome: "annualNetIncome",
  totalAssets: "annualTotalAssets",
  totalLiabilities: "annualTotalLiabilitiesNetMinorityInterest",
  eps: "annualBasicEPS",
} as const;

type SeriesKey = keyof typeof SERIES;

const dataPointSchema = z.object({
  asOfDate: z.string(),
  periodType: z.string().optional(),
  currencyCode: z.string().optional(),
  reportedValue: z.object({ raw: z.number() }).optional(),
});

const resultSchema = z.object({
  meta: z.object({ type: z.array(z.string()).optional() }).optional(),
  // The series array is keyed by its own type name, so it can't be named here —
  // it's picked out by key after the envelope validates.
});

const envelopeSchema = z.object({
  timeseries: z.object({
    result: z.array(resultSchema.passthrough()).nullable().optional(),
    error: z.unknown().nullable().optional(),
  }),
});

const MAX_RETRIES = Number(process.env.YAHOO_MAX_RETRIES ?? 3);

/** Thrown on 429 so callers can stop a run instead of grinding through a quota block. */
export class YahooRateLimitError extends Error {
  constructor(symbol: string) {
    super(`Yahoo rate-limited the request for ${symbol}`);
    this.name = "YahooRateLimitError";
  }
}

// Yahoo enforces a rolling per-IP quota on this endpoint. It sends no
// Retry-After and no quota headers — just `429 Too Many Requests` — and once
// tripped it stays tripped for a while, so the useful response is to wait a
// long time and then give up, not to retry quickly. Callers ingest weekly, so
// slow is free; see INTER_REQUEST_MS in scripts/ingest-yahoo.ts.
const RETRY_DELAYS_MS = [30_000, 90_000, 240_000];

async function fetchWithBackoff(url: string, symbol: string): Promise<Response> {
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const base = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      // Jitter so a batch never retries in lockstep.
      await new Promise((r) => setTimeout(r, base + Math.random() * 5_000));
    }

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) return res;
    lastStatus = res.status;

    // 404 means the symbol is wrong; retrying won't change that.
    if (res.status !== 429 && res.status < 500) break;
  }

  if (lastStatus === 429) throw new YahooRateLimitError(symbol);
  throw new Error(`Yahoo request failed: ${lastStatus} ${symbol}`);
}

/** Normalised per-fiscal-year figures for one company, keyed by fiscal year. */
export interface YahooFacts {
  symbol: string;
  currency: string | null;
  years: Map<number, Partial<Record<SeriesKey, number>>>;
}

export async function getFundamentals(symbol: string): Promise<YahooFacts> {
  const types = Object.values(SERIES).join(",");
  // period1 is deliberately far back: we want enough history for a prior-year
  // revenue comparison even for companies with sparse coverage.
  const period1 = Math.floor(Date.parse("2015-01-01") / 1000);
  const period2 = Math.floor(Date.now() / 1000);

  const url = `${BASE}/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(
    symbol
  )}&type=${types}&period1=${period1}&period2=${period2}&merge=false`;

  const res = await fetchWithBackoff(url, symbol);

  const parsed = envelopeSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`Yahoo response shape unrecognised for ${symbol}`);

  const years = new Map<number, Partial<Record<SeriesKey, number>>>();
  let currency: string | null = null;

  for (const result of parsed.data.timeseries.result ?? []) {
    const typeName = result.meta?.type?.[0];
    if (!typeName) continue;

    const key = (Object.keys(SERIES) as SeriesKey[]).find((k) => SERIES[k] === typeName);
    if (!key) continue;

    const points = (result as Record<string, unknown>)[typeName];
    if (!Array.isArray(points)) continue;

    for (const raw of points) {
      const point = dataPointSchema.safeParse(raw);
      if (!point.success) continue;

      const { asOfDate, periodType, currencyCode, reportedValue } = point.data;
      // Annual series only — Yahoo occasionally mixes in trailing-twelve-month
      // rows, which would double-count against the real fiscal year.
      if (periodType && periodType !== "12M") continue;
      if (reportedValue?.raw == null) continue;

      // Fiscal year = calendar year the period ends in. Toyota's FY ending
      // 2026-03-31 is FY2026, matching how the company itself labels it.
      const fiscalYear = Number(asOfDate.slice(0, 4));
      if (!Number.isFinite(fiscalYear)) continue;

      const bucket = years.get(fiscalYear) ?? {};
      bucket[key] = reportedValue.raw;
      years.set(fiscalYear, bucket);

      // EPS is quoted per share in the same currency; any monetary series is a
      // valid source for the report currency.
      if (!currency && currencyCode) currency = currencyCode;
    }
  }

  return { symbol, currency, years };
}

export function latestAvailableFiscalYear(facts: YahooFacts): number | null {
  // Require revenue — a year with only a balance-sheet figure produces an
  // Insight with nothing worth narrating.
  const years = [...facts.years.entries()]
    .filter(([, figures]) => figures.revenue != null)
    .map(([year]) => year);
  return years.length ? Math.max(...years) : null;
}

export function extractFiscalYearMetrics(
  facts: YahooFacts,
  fiscalYear: number
): FiscalYearMetrics {
  const current = facts.years.get(fiscalYear) ?? {};
  const prior = facts.years.get(fiscalYear - 1) ?? {};

  return deriveMetrics(
    fiscalYear,
    {
      revenue: current.revenue ?? null,
      priorRevenue: prior.revenue ?? null,
      netIncome: current.netIncome ?? null,
      totalAssets: current.totalAssets ?? null,
      totalLiabilities: current.totalLiabilities ?? null,
      eps: current.eps ?? null,
    },
    facts.currency
  );
}

export function quoteUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}
