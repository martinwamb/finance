import nodemailer from "nodemailer";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST,
    port: Number(process.env.MAIL_SMTP_PORT ?? 587),
    secure: process.env.MAIL_SMTP_PORT === "465",
    auth: {
      user: process.env.MAIL_SMTP_USER,
      pass: process.env.MAIL_SMTP_PASS,
    },
  });

  return transport;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const from = process.env.MAIL_SMTP_FROM ?? "Finance Insights <finance@wambugumartin.com>";
  return getTransport().sendMail({ from, ...opts });
}
