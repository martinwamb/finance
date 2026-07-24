import { db } from "@/lib/db";
import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";

export const metadata = { title: "Companies — Finance Insights" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: {
      ticker: true,
      name: true,
      sector: true,
      exchange: { select: { code: true } },
      reports: { where: { status: "ANALYZED" }, select: { id: true }, take: 1 },
    },
  });

  const rows: CompanyRow[] = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    exchangeCode: c.exchange.code,
    hasInsight: c.reports.length > 0,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {rows.length} companies tracked across NSE Kenya, NASDAQ and NYSE.
      </p>
      <CompaniesTable rows={rows} />
    </div>
  );
}
