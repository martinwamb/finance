import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyCharts, type FiscalPoint } from "@/components/charts/company-charts";
import { formatCompact, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Scoped by exchange because tickers are only unique per venue
// (Company has @@unique([exchangeId, ticker])) — "SAN" is Sanofi in Paris and
// Banco Santander in Madrid, and a bare ticker lookup would return whichever
// row the database happened to hand back first.
export default async function CompanyPage(props: PageProps<"/company/[exchange]/[ticker]">) {
  const { exchange, ticker } = await props.params;

  const company = await db.company.findFirst({
    where: {
      ticker: { equals: ticker, mode: "insensitive" },
      exchange: { code: { equals: exchange, mode: "insensitive" } },
    },
    include: {
      exchange: true,
      reports: {
        where: { status: "ANALYZED" },
        orderBy: { fiscalYear: "desc" },
        include: { insight: true },
      },
    },
  });

  if (!company) notFound();

  const chartData: FiscalPoint[] = company.reports
    .slice()
    .reverse()
    .map((r) => ({
      fiscalYear: r.fiscalYear,
      revenue: r.insight?.revenue?.toNumber() ?? null,
      netIncome: r.insight?.netIncome?.toNumber() ?? null,
      revenueGrowthPct: r.insight?.revenueGrowthPct?.toNumber() ?? null,
      profitMarginPct: r.insight?.profitMarginPct?.toNumber() ?? null,
    }));

  const latestReport = company.reports[0];
  const latestInsight = latestReport?.insight;
  // A company reports in one currency, so the newest report's currency labels
  // the whole series.
  const currency = latestReport?.currency ?? "USD";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{company.exchange.code}</Badge>
            {company.sector && <Badge variant="outline">{company.sector}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.ticker}</p>
        </div>
        {latestInsight && (
          <div className="flex gap-6 text-right text-sm">
            <div>
              <p className="text-muted-foreground">Revenue</p>
              <p className="font-medium">
                {formatCompact(latestInsight.revenue?.toNumber(), currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">EPS</p>
              <p className="font-medium">{formatNumber(latestInsight.eps?.toNumber())}</p>
            </div>
          </div>
        )}
      </div>

      {latestInsight ? (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                FY{latestReport.fiscalYear} summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed">{latestInsight.summary}</p>
              {Array.isArray(latestInsight.highlights) && latestInsight.highlights.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {(latestInsight.highlights as string[]).map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-foreground">·</span>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {chartData.length > 0 && <CompanyCharts data={chartData} currency={currency} />}
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No analyzed reports yet for {company.name}. Check back after the next processing run.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
