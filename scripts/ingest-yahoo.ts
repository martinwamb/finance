// Queues PENDING reports for every non-US company that has a Yahoo symbol —
// the European and Asian venues. Mirrors scripts/ingest-edgar.ts: pulls the
// latest annual figures, writes one Report per unseen fiscal year, and calls no
// LLM, so it can run at any time of day (narration happens in the off-peak
// analyze worker).
import "dotenv/config";
import { db } from "../src/lib/db";
import {
  getFundamentals,
  latestAvailableFiscalYear,
  extractFiscalYearMetrics,
  quoteUrl,
  YahooRateLimitError,
} from "../src/lib/yahoo";

// Yahoo enforces a rolling per-IP quota and a burst will trip it for hours.
// This job runs weekly over ~120 symbols, so pacing it at seconds per request
// costs nothing and keeps us comfortably under. Do not lower this to "speed up"
// a manual run — a tripped quota takes far longer to clear than the run saves.
const INTER_REQUEST_MS = Number(process.env.YAHOO_INTER_REQUEST_MS ?? 4_000);
// Once the quota is gone every remaining symbol will fail too. Stop and let the
// next run resume rather than grinding through the whole list; the job is
// idempotent (it skips fiscal years already stored), so nothing is lost.
const MAX_CONSECUTIVE_RATE_LIMITS = Number(process.env.YAHOO_MAX_CONSECUTIVE_429 ?? 3);

async function main() {
  const companies = await db.company.findMany({
    where: { yahooSymbol: { not: null } },
    include: { exchange: true },
  });

  console.log(
    `${companies.length} company(ies) with a Yahoo symbol; ${INTER_REQUEST_MS}ms between requests.`
  );
  let queued = 0;
  let skipped = 0;
  let consecutiveRateLimits = 0;

  for (const company of companies) {
    const symbol = company.yahooSymbol!;

    try {
      const facts = await getFundamentals(symbol);
      const fiscalYear = latestAvailableFiscalYear(facts);
      if (!fiscalYear) {
        console.log(`${symbol}: no annual revenue reported, skipping`);
        continue;
      }

      consecutiveRateLimits = 0;

      const existing = await db.report.findUnique({
        where: {
          companyId_fiscalYear_period: {
            companyId: company.id,
            fiscalYear,
            period: "ANNUAL",
          },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const metrics = extractFiscalYearMetrics(facts, fiscalYear);
      await db.report.create({
        data: {
          companyId: company.id,
          fiscalYear,
          period: "ANNUAL",
          source: "YAHOO",
          sourceUrl: quoteUrl(symbol),
          rawText: JSON.stringify(metrics),
          currency: metrics.currency,
          status: "PENDING",
        },
      });
      queued++;
      console.log(`${symbol}: queued FY${fiscalYear} (${metrics.currency ?? "currency unknown"})`);
    } catch (err) {
      if (err instanceof YahooRateLimitError) {
        consecutiveRateLimits++;
        console.error(
          `${symbol}: rate-limited (${consecutiveRateLimits}/${MAX_CONSECUTIVE_RATE_LIMITS})`
        );
        if (consecutiveRateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) {
          console.error("Quota exhausted — stopping. The next run resumes where this left off.");
          break;
        }
      } else {
        // Yahoo's endpoint is undocumented — one company failing to parse must
        // not take the run down.
        console.error(`${symbol}: ${err}`);
      }
    }

    await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
  }

  console.log(`Done. ${queued} report(s) queued, ${skipped} already present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
