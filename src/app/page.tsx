import Link from "next/link";
import { db } from "@/lib/db";
import { FinanceGlobe, type GlobePoint } from "@/components/globe/finance-globe";
import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const companies = await db.company.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: {
      ticker: true,
      name: true,
      sector: true,
      lat: true,
      lng: true,
      exchange: { select: { code: true } },
      reports: { where: { status: "ANALYZED" }, select: { id: true }, take: 1 },
    },
  });

  const points: GlobePoint[] = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    exchangeCode: c.exchange.code,
    sector: c.sector,
    lat: c.lat!,
    lng: c.lng!,
    hasInsight: c.reports.length > 0,
  }));

  const latest = await db.report.findMany({
    where: { status: "ANALYZED" },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: { company: { include: { exchange: true } }, insight: true },
  });

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative h-[70vh] min-h-[420px] w-full border-b border-border/60">
        <FinanceGlobe points={points} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-6 pt-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Corporate insights, from the source.
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground sm:text-base">
            Spin the globe. Every point is a listed company — click one for financial insights
            drawn straight from its own annual and quarterly reports.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Latest insights</h2>
          <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
            Browse all companies →
          </Link>
        </div>

        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No analyzed reports yet — check back after the next off-peak processing run.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((report) => (
              <Link key={report.id} href={`/company/${report.company.ticker}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{report.company.name}</CardTitle>
                      <Badge variant="secondary">{report.company.exchange.code}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {report.insight?.summary}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <span>
                        Revenue{" "}
                        <span className="font-medium text-foreground">
                          {formatCompact(report.insight?.revenue?.toNumber())}
                        </span>
                      </span>
                      <span>
                        YoY{" "}
                        <span className="font-medium text-foreground">
                          {formatPct(report.insight?.revenueGrowthPct?.toNumber())}
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="subscribe" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-16">
          <h2 className="text-lg font-semibold tracking-tight">Twice-weekly newsletter</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            The clearest moves across NSE Kenya, NASDAQ and NYSE, distilled from the latest
            filings — no noise, delivered Tuesday and Friday.
          </p>
          <SubscribeForm />
        </div>
      </section>
    </div>
  );
}
