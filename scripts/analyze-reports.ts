// Runs exclusively inside the server's 22:00-06:00 UTC Ollama off-peak window
// (see ecosystem.config.js's cron_restart for this worker) — the box has no
// GPU, so qwen3:14b can only run there without starving other services.
import "dotenv/config";
import { db } from "../src/lib/db";
import { analyzeReportText, narrateMetrics, isOllamaReachable } from "../src/lib/ollama";

const MAX_PER_RUN = Number(process.env.REPORT_ANALYSIS_MAX_PER_RUN ?? 6);
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:14b";

async function main() {
  if (!(await isOllamaReachable())) {
    console.error("Ollama is not reachable — outside the off-peak window? Aborting.");
    process.exit(1);
  }

  const pending = await db.report.findMany({
    where: { status: "PENDING" },
    include: { company: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  });

  console.log(`Found ${pending.length} pending report(s).`);

  for (const report of pending) {
    await db.report.update({ where: { id: report.id }, data: { status: "PROCESSING" } });

    try {
      let result: {
        summary: string;
        highlights: string[];
        revenue?: number | null;
        netIncome?: number | null;
        totalAssets?: number | null;
        totalLiabilities?: number | null;
        eps?: number | null;
        revenueGrowthPct?: number | null;
        profitMarginPct?: number | null;
      };

      if (report.source === "UPLOAD") {
        if (!report.rawText) throw new Error("upload report has no extracted text");
        result = await analyzeReportText(report.company.name, report.fiscalYear, report.rawText);
      } else {
        const known = JSON.parse(report.rawText ?? "{}");
        const narrated = await narrateMetrics(report.company.name, report.fiscalYear, known);
        result = { ...known, ...narrated };
      }

      await db.insight.create({
        data: {
          reportId: report.id,
          revenue: result.revenue ?? undefined,
          netIncome: result.netIncome ?? undefined,
          totalAssets: result.totalAssets ?? undefined,
          totalLiabilities: result.totalLiabilities ?? undefined,
          eps: result.eps ?? undefined,
          revenueGrowthPct: result.revenueGrowthPct ?? undefined,
          profitMarginPct: result.profitMarginPct ?? undefined,
          summary: result.summary,
          highlights: result.highlights,
          model: MODEL,
        },
      });

      await db.report.update({ where: { id: report.id }, data: { status: "ANALYZED" } });
      console.log(`${report.company.ticker} FY${report.fiscalYear}: analyzed`);
    } catch (err) {
      await db.report.update({
        where: { id: report.id },
        data: { status: "FAILED", failReason: String(err).slice(0, 500) },
      });
      console.error(`${report.company.ticker} FY${report.fiscalYear}: failed — ${err}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
