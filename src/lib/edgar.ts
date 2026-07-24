// SEC EDGAR is free and requires no API key, but does require a descriptive
// User-Agent identifying the app per SEC's fair-access policy:
// https://www.sec.gov/os/webmaster-faq#developers

const USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "Finance Insights (finance@wambugumartin.com)";

async function edgarFetch(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`EDGAR request failed: ${res.status} ${url}`);
  return res.json();
}

export function padCik(cik: string) {
  return cik.replace(/\D/g, "").padStart(10, "0");
}

let tickerMapCache: Map<string, string> | null = null;

// SEC's official ticker->CIK mapping (no key required) — resolved at runtime
// instead of hardcoding CIK numbers, which drift as companies re-list/restructure.
async function getTickerMap(): Promise<Map<string, string>> {
  if (tickerMapCache) return tickerMapCache;
  const data = (await edgarFetch("https://www.sec.gov/files/company_tickers.json")) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  tickerMapCache = new Map(
    Object.values(data).map((row) => [row.ticker.toUpperCase(), String(row.cik_str)])
  );
  return tickerMapCache;
}

export async function resolveCikByTicker(ticker: string): Promise<string | null> {
  const map = await getTickerMap();
  return map.get(ticker.toUpperCase()) ?? null;
}

interface CompanyFacts {
  facts?: {
    "us-gaap"?: Record<
      string,
      {
        units: Record<
          string,
          { end: string; val: number; fy: number; fp: string; form: string; frame?: string }[]
        >;
      }
    >;
  };
}

export async function getCompanyFacts(cik: string): Promise<CompanyFacts> {
  return edgarFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`);
}

const TAGS = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"],
  netIncome: ["NetIncomeLoss"],
  totalAssets: ["Assets"],
  totalLiabilities: ["Liabilities"],
  eps: ["EarningsPerShareBasic", "EarningsPerShareBasicAndDiluted"],
};

function latestAnnualValue(
  facts: CompanyFacts,
  tags: string[],
  fiscalYear: number
): number | null {
  for (const tag of tags) {
    const usd = facts.facts?.["us-gaap"]?.[tag]?.units?.USD;
    const perShare = facts.facts?.["us-gaap"]?.[tag]?.units?.["USD/shares"];
    const points = usd ?? perShare;
    if (!points) continue;
    const match = points.find((p) => p.form === "10-K" && p.fy === fiscalYear && p.fp === "FY");
    if (match) return match.val;
  }
  return null;
}

export interface EdgarFiscalYearMetrics {
  fiscalYear: number;
  revenue: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  eps: number | null;
  revenueGrowthPct: number | null;
  profitMarginPct: number | null;
}

export function extractFiscalYearMetrics(
  facts: CompanyFacts,
  fiscalYear: number
): EdgarFiscalYearMetrics {
  const revenue = latestAnnualValue(facts, TAGS.revenue, fiscalYear);
  const priorRevenue = latestAnnualValue(facts, TAGS.revenue, fiscalYear - 1);
  const netIncome = latestAnnualValue(facts, TAGS.netIncome, fiscalYear);

  return {
    fiscalYear,
    revenue,
    netIncome,
    totalAssets: latestAnnualValue(facts, TAGS.totalAssets, fiscalYear),
    totalLiabilities: latestAnnualValue(facts, TAGS.totalLiabilities, fiscalYear),
    eps: latestAnnualValue(facts, TAGS.eps, fiscalYear),
    revenueGrowthPct:
      revenue != null && priorRevenue ? ((revenue - priorRevenue) / priorRevenue) * 100 : null,
    profitMarginPct: revenue && netIncome != null ? (netIncome / revenue) * 100 : null,
  };
}

export function latestAvailableFiscalYear(facts: CompanyFacts): number | null {
  const points = facts.facts?.["us-gaap"]?.["Assets"]?.units?.USD ?? [];
  const years = points.filter((p) => p.form === "10-K" && p.fp === "FY").map((p) => p.fy);
  return years.length ? Math.max(...years) : null;
}
