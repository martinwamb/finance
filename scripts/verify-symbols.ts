// Ad-hoc check that every seeded Yahoo symbol still resolves to real annual
// fundamentals. Run after editing prisma/data/international.ts — an unrecognised
// symbol fails silently at ingest time otherwise (the company is simply never
// covered), which is exactly the kind of quiet gap that is hard to notice.
import "dotenv/config";
import { getFundamentals, latestAvailableFiscalYear, extractFiscalYearMetrics } from "../src/lib/yahoo";
import { INTERNATIONAL_EXCHANGES } from "../prisma/data/international";

async function main() {
  const only = process.argv[2];
  let ok = 0;
  const bad: string[] = [];

  for (const ex of INTERNATIONAL_EXCHANGES) {
    if (only && ex.code !== only) continue;
    for (const c of ex.companies) {
      const symbol = c.yahooSymbol ?? `${c.ticker}${ex.yahooSuffix}`;
      try {
        const facts = await getFundamentals(symbol);
        const fy = latestAvailableFiscalYear(facts);
        if (!fy) throw new Error("no annual revenue");
        const m = extractFiscalYearMetrics(facts, fy);
        console.log(
          `ok   ${ex.code.padEnd(7)} ${symbol.padEnd(14)} FY${fy} ${String(m.currency).padEnd(4)} rev=${m.revenue} growth=${m.revenueGrowthPct?.toFixed(1) ?? "—"}%`
        );
        ok++;
      } catch (err) {
        console.error(`FAIL ${ex.code.padEnd(7)} ${symbol.padEnd(14)} ${err}`);
        bad.push(symbol);
      }
      // Same pacing as the real ingest. Running this back-to-back with an
      // ingest will still trip Yahoo's rolling quota — space them out.
      await new Promise((r) => setTimeout(r, Number(process.env.YAHOO_INTER_REQUEST_MS ?? 4_000)));
    }
  }

  console.log(`\n${ok} ok, ${bad.length} failed${bad.length ? `: ${bad.join(", ")}` : ""}`);
  if (bad.length) process.exit(1);
}

main();
