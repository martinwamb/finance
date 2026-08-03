import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { formatCompact, formatPct } from "@/lib/format";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.wambugumartin.com";
const ADMIN_ALERT_TO = process.env.ADMIN_ALERT_EMAIL;

const REGION_LABELS = {
  AMERICAS: "Americas",
  EMEA: "Europe, Middle East & Africa",
  APAC: "Asia-Pacific",
} as const;

const REGION_ORDER = ["AMERICAS", "EMEA", "APAC"] as const;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("x-cron-secret") === secret;
}

// An empty newsletter is the exact symptom that hid a broken analysis pipeline
// for weeks — the cron logged "no analyzed reports" into a file nobody read.
// Make it arrive somewhere a human will see it.
async function alertAdmin(reason: string) {
  if (!ADMIN_ALERT_TO) return;
  try {
    await sendMail({
      to: ADMIN_ALERT_TO,
      subject: "Finance Insights — newsletter could not be generated",
      text: `The newsletter cron ran but produced nothing.\n\nReason: ${reason}\n\nCheck the analysis worker: /home/admin/logs/finance-analyze.log`,
      html: `<p>The newsletter cron ran but produced nothing.</p><p><strong>Reason:</strong> ${reason}</p><p>Check the analysis worker log at <code>/home/admin/logs/finance-analyze.log</code>.</p>`,
    });
  } catch (err) {
    console.error(`Failed to send admin alert: ${err}`);
  }
}

async function generate() {
  const reports = await db.report.findMany({
    where: { status: "ANALYZED" },
    orderBy: { updatedAt: "desc" },
    take: 9,
    include: { company: { include: { exchange: true } }, insight: true },
  });

  if (reports.length === 0) {
    const reason = "No analyzed reports available.";
    await alertAdmin(reason);
    return { created: false as const, reason };
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Finance Insights — ${dateLabel}`;

  // Group by region so one issue reads as Americas / EMEA / APAC sections
  // rather than an undifferentiated list of mixed-currency figures.
  const byRegion = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = r.company.exchange.region;
    byRegion.set(key, [...(byRegion.get(key) ?? []), r]);
  }
  const regions = REGION_ORDER.filter((key) => byRegion.has(key));

  const companyUrl = (r: (typeof reports)[number]) =>
    `${BASE_URL}/company/${r.company.exchange.code}/${r.company.ticker}`;

  const sectionsHtml = regions
    .map((key) => {
      const rows = byRegion
        .get(key)!
        .map((r) => {
          // Currency is per-report: Shell files in USD despite listing in
          // London, so this can't be derived from the exchange.
          const currency = r.currency ?? "USD";
          return `
        <tr>
          <td style="padding:16px 0;border-top:1px solid #e1e0d9;">
            <p style="margin:0 0 4px;font-size:13px;color:#898781;">${r.company.exchange.code} · ${r.company.sector ?? ""}</p>
            <p style="margin:0 0 6px;font-size:16px;font-weight:600;">
              <a href="${companyUrl(r)}" style="color:#0b0b0b;text-decoration:none;">${r.company.name}</a>
            </p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#52514e;">${r.insight?.summary ?? ""}</p>
            <p style="margin:0;font-size:13px;color:#52514e;">
              Revenue ${formatCompact(r.insight?.revenue?.toNumber(), currency)} · YoY ${formatPct(r.insight?.revenueGrowthPct?.toNumber())}
            </p>
          </td>
        </tr>`;
        })
        .join("");

      return `
      <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#898781;margin:28px 0 0;">${REGION_LABELS[key]}</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>`;
    })
    .join("");

  const bodyHtml = `
    <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b;">
      <h1 style="font-size:20px;margin:0 0 4px;">Finance Insights</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#898781;">${dateLabel}</p>
      ${sectionsHtml}
      <p style="margin:32px 0 0;font-size:12px;color:#898781;">
        You're receiving this because you subscribed at finance.wambugumartin.com.
        <a href="{{unsubscribe_url}}" style="color:#898781;">Unsubscribe</a>
      </p>
    </div>`;

  const bodyText = regions
    .map((key) => {
      const rows = byRegion
        .get(key)!
        .map((r) => {
          const currency = r.currency ?? "USD";
          return `${r.company.name} (${r.company.exchange.code})\n${r.insight?.summary ?? ""}\nRevenue ${formatCompact(r.insight?.revenue?.toNumber(), currency)} · YoY ${formatPct(r.insight?.revenueGrowthPct?.toNumber())}\n${companyUrl(r)}\n`;
        })
        .join("\n---\n\n");
      return `${REGION_LABELS[key].toUpperCase()}\n\n${rows}`;
    })
    .join("\n\n");

  await db.newsletter.create({
    data: { subject, bodyHtml, bodyText, status: "DRAFT" },
  });

  return { created: true as const };
}

async function send() {
  const draft = await db.newsletter.findFirst({
    where: { status: "DRAFT" },
    orderBy: { generatedAt: "desc" },
  });
  if (!draft) {
    const reason = "No draft newsletter to send.";
    await alertAdmin(reason);
    return { sent: 0, reason };
  }

  const subscribers = await db.subscriber.findMany({
    where: { confirmed: true, unsubscribedAt: null },
  });

  if (subscribers.length === 0) {
    await alertAdmin("A newsletter draft exists but there are no confirmed subscribers.");
  }

  let sent = 0;
  for (const sub of subscribers) {
    const unsubscribeUrl = `${BASE_URL}/api/subscribe/unsubscribe?token=${sub.unsubscribeToken}`;
    try {
      await sendMail({
        to: sub.email,
        subject: draft.subject,
        html: draft.bodyHtml.replace("{{unsubscribe_url}}", unsubscribeUrl),
        text: `${draft.bodyText}\n\nUnsubscribe: ${unsubscribeUrl}`,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${sub.email}: ${err}`);
    }
  }

  await db.newsletter.update({
    where: { id: draft.id },
    data: { status: "SENT", sentAt: new Date(), recipientCount: sent },
  });

  return { sent };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "generate") {
    const result = await generate();
    return NextResponse.json(result);
  }

  if (mode === "send") {
    const result = await send();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "mode must be 'generate' or 'send'" }, { status: 400 });
}
