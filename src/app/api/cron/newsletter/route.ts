import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { formatCompact, formatPct } from "@/lib/format";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.wambugumartin.com";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("x-cron-secret") === secret;
}

async function generate() {
  const reports = await db.report.findMany({
    where: { status: "ANALYZED" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { company: { include: { exchange: true } }, insight: true },
  });

  if (reports.length === 0) {
    return { created: false as const, reason: "No analyzed reports available." };
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Finance Insights — ${dateLabel}`;

  const itemsHtml = reports
    .map((r) => {
      const url = `${BASE_URL}/company/${r.company.ticker}`;
      return `
        <tr>
          <td style="padding:16px 0;border-top:1px solid #e1e0d9;">
            <p style="margin:0 0 4px;font-size:13px;color:#898781;">${r.company.exchange.code} · ${r.company.sector ?? ""}</p>
            <p style="margin:0 0 6px;font-size:16px;font-weight:600;">
              <a href="${url}" style="color:#0b0b0b;text-decoration:none;">${r.company.name}</a>
            </p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#52514e;">${r.insight?.summary ?? ""}</p>
            <p style="margin:0;font-size:13px;color:#52514e;">
              Revenue ${formatCompact(r.insight?.revenue?.toNumber())} · YoY ${formatPct(r.insight?.revenueGrowthPct?.toNumber())}
            </p>
          </td>
        </tr>`;
    })
    .join("");

  const bodyHtml = `
    <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b;">
      <h1 style="font-size:20px;margin:0 0 4px;">Finance Insights</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#898781;">${dateLabel}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;">${itemsHtml}</table>
      <p style="margin:32px 0 0;font-size:12px;color:#898781;">
        You're receiving this because you subscribed at finance.wambugumartin.com.
        <a href="{{unsubscribe_url}}" style="color:#898781;">Unsubscribe</a>
      </p>
    </div>`;

  const bodyText = reports
    .map(
      (r) =>
        `${r.company.name} (${r.company.exchange.code})\n${r.insight?.summary ?? ""}\nRevenue ${formatCompact(r.insight?.revenue?.toNumber())} · YoY ${formatPct(r.insight?.revenueGrowthPct?.toNumber())}\n${BASE_URL}/company/${r.company.ticker}\n`
    )
    .join("\n---\n\n");

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
  if (!draft) return { sent: 0, reason: "No draft newsletter to send." };

  const subscribers = await db.subscriber.findMany({
    where: { confirmed: true, unsubscribedAt: null },
  });

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
