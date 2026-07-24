// Pulls the latest annual XBRL figures for every curated company that has a
// resolved SEC CIK, and queues a PENDING Report for any fiscal year not yet
// seen. Does not call Ollama — narration happens in the off-peak analyze
// worker (scripts/analyze-reports.ts) so this script can run any time of day.
import "dotenv/config";
import { db } from "../src/lib/db";
import { getCompanyFacts, extractFiscalYearMetrics, latestAvailableFiscalYear } from "../src/lib/edgar";

async function main() {
  const companies = await db.company.findMany({ where: { cik: { not: null } } });
  let queued = 0;

  for (const company of companies) {
    try {
      const facts = await getCompanyFacts(company.cik!);
      const fiscalYear = latestAvailableFiscalYear(facts);
      if (!fiscalYear) {
        console.log(`${company.ticker}: no 10-K facts found, skipping`);
        continue;
      }

      const existing = await db.report.findUnique({
        where: {
          companyId_fiscalYear_period: {
            companyId: company.id,
            fiscalYear,
            period: "ANNUAL",
          },
        },
      });
      if (existing) continue;

      const metrics = extractFiscalYearMetrics(facts, fiscalYear);
      await db.report.create({
        data: {
          companyId: company.id,
          fiscalYear,
          period: "ANNUAL",
          source: "EDGAR",
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=10-K`,
          rawText: JSON.stringify(metrics),
          status: "PENDING",
        },
      });
      queued++;
      console.log(`${company.ticker}: queued FY${fiscalYear}`);
    } catch (err) {
      console.error(`${company.ticker}: ${err}`);
    }

    // SEC fair-access: stay well under 10 req/s.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. ${queued} report(s) queued.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
