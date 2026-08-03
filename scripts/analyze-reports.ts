// Runs exclusively inside the server's 22:00-06:00 UTC Ollama off-peak window
// (see ecosystem.config.js's cron_restart for this worker) — the box has no
// GPU, so the model can only run there without starving other services.
//
// Works to a wall-clock deadline rather than a fixed report count: how many
// reports fit in a night depends on the model and the prompt, and a fixed count
// either wastes window or gets killed mid-report when Ollama stops at 06:00.
import "dotenv/config";
import { db } from "../src/lib/db";
import { analyzeReportText, narrateMetrics, isOllamaReachable } from "../src/lib/ollama";

const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";
const MAX_ATTEMPTS = Number(process.env.REPORT_ANALYSIS_MAX_ATTEMPTS ?? 3);
// "HH:MM" UTC. Ollama is stopped at 06:00 by ollama-window-stop.timer; stopping
// short of that leaves room for the last report to finish and commit.
const DEADLINE_UTC = process.env.ANALYZE_DEADLINE_UTC ?? "05:30";
// A report left PROCESSING for longer than this belongs to a run that was
// killed; without this it would be stranded forever.
const STALE_PROCESSING_MS = Number(process.env.ANALYZE_STALE_MS ?? 60 * 60_000);

function deadlineTimestamp(): number {
  const [hh, mm] = DEADLINE_UTC.split(":").map(Number);
  const now = new Date();
  const deadline = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, 0, 0)
  );
  // Runs start at 22:00 UTC, so the deadline falls on the following day.
  if (deadline.getTime() <= now.getTime()) deadline.setUTCDate(deadline.getUTCDate() + 1);
  return deadline.getTime();
}

// Reclaim reports abandoned by a killed run so they re-enter the queue.
async function requeueStale() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const { count } = await db.report.updateMany({
    where: { status: "PROCESSING", lastAttemptAt: { lt: cutoff } },
    data: { status: "PENDING" },
  });
  if (count > 0) console.log(`Requeued ${count} stale PROCESSING report(s).`);
}

// PENDING first, then FAILED that haven't exhausted their retries — a transient
// Ollama outage shouldn't put a report permanently out of reach. Fewest
// attempts first so one poison report can't monopolise the window.
async function nextReport() {
  return db.report.findFirst({
    where: {
      attempts: { lt: MAX_ATTEMPTS },
      status: { in: ["PENDING", "FAILED"] },
    },
    include: { company: true },
    orderBy: [{ attempts: "asc" }, { createdAt: "asc" }],
  });
}

async function main() {
  if (!(await isOllamaReachable())) {
    console.error("Ollama is not reachable — outside the off-peak window? Aborting.");
    process.exit(1);
  }

  await requeueStale();

  const deadline = deadlineTimestamp();
  console.log(
    `Model ${MODEL}; working until ${new Date(deadline).toISOString()} (max ${MAX_ATTEMPTS} attempts/report).`
  );

  let analyzed = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const report = await nextReport();
    if (!report) {
      console.log("Queue empty.");
      break;
    }

    // Ollama is stopped abruptly at the end of the window; checking between
    // reports ends the run with a clear message instead of a fetch error.
    if (!(await isOllamaReachable())) {
      console.log("Ollama went away — window closed. Stopping.");
      break;
    }

    await db.report.update({
      where: { id: report.id },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });

    const label = `${report.company.ticker} FY${report.fiscalYear}`;

    try {
      let result: Awaited<ReturnType<typeof analyzeReportText>>;

      if (report.source === "UPLOAD") {
        if (!report.rawText) throw new Error("upload report has no extracted text");
        result = await analyzeReportText(report.company.name, report.fiscalYear, report.rawText);
      } else {
        // EDGAR and Yahoo both arrive with exact figures already extracted, so
        // the model only has to write the prose.
        const known = JSON.parse(report.rawText ?? "{}");
        const narrated = await narrateMetrics(
          report.company.name,
          report.fiscalYear,
          known,
          report.currency
        );
        result = { ...known, ...narrated };
      }

      // A retried report may already have an Insight from a partial earlier run.
      await db.insight.upsert({
        where: { reportId: report.id },
        create: {
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
        update: {
          summary: result.summary,
          highlights: result.highlights,
          model: MODEL,
          generatedAt: new Date(),
        },
      });

      await db.report.update({
        where: { id: report.id },
        data: { status: "ANALYZED", failReason: null },
      });
      analyzed++;
      console.log(`${label}: analyzed`);
    } catch (err) {
      await db.report.update({
        where: { id: report.id },
        data: { status: "FAILED", failReason: String(err).slice(0, 500) },
      });
      failed++;
      console.error(`${label}: failed — ${err}`);
    }
  }

  console.log(`Done. ${analyzed} analyzed, ${failed} failed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
