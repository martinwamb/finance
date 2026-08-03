// Shared shape for a single fiscal year of company financials, plus the ratio
// derivations, so every provider (SEC EDGAR for US filers, Yahoo for the rest)
// produces identical records and the analysis worker doesn't care where a
// report came from.

export interface FiscalYearMetrics {
  fiscalYear: number;
  revenue: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  eps: number | null;
  revenueGrowthPct: number | null;
  profitMarginPct: number | null;
  // ISO 4217, when the source reports it. EDGAR figures are USD by definition
  // (we only read the USD unit); Yahoo states it per series and it is not
  // always the currency you'd guess from the listing venue.
  currency: string | null;
}

export interface RawFigures {
  revenue: number | null;
  priorRevenue: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  eps: number | null;
}

// Growth needs a prior year to compare against; margin needs a non-zero
// revenue. Both stay null rather than reporting a misleading 0.
export function deriveMetrics(
  fiscalYear: number,
  figures: RawFigures,
  currency: string | null
): FiscalYearMetrics {
  const { revenue, priorRevenue, netIncome } = figures;

  return {
    fiscalYear,
    revenue,
    netIncome,
    totalAssets: figures.totalAssets,
    totalLiabilities: figures.totalLiabilities,
    eps: figures.eps,
    revenueGrowthPct:
      revenue != null && priorRevenue ? ((revenue - priorRevenue) / priorRevenue) * 100 : null,
    profitMarginPct: revenue && netIncome != null ? (netIncome / revenue) * 100 : null,
    currency,
  };
}

// A source of annual fundamentals for one company. Implementations are
// selected per-company by `resolveProvider` in src/lib/providers.ts.
export interface FundamentalsProvider {
  readonly name: "EDGAR" | "YAHOO";
  /** Stable per-company handle for this provider (a CIK, a Yahoo symbol). */
  identifierFor(company: { cik: string | null; yahooSymbol: string | null }): string | null;
  /** Fetches whatever payload the extract/latest helpers need, once per company. */
  fetchFacts(identifier: string): Promise<unknown>;
  latestAvailableFiscalYear(facts: unknown): number | null;
  extractFiscalYearMetrics(facts: unknown, fiscalYear: number): FiscalYearMetrics;
  /** Human-readable provenance link stored on the Report. */
  sourceUrl(identifier: string): string;
}
