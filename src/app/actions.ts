"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/tokens";
import { sendMail } from "@/lib/mailer";

const emailSchema = z.email();

export interface SubscribeState {
  success: boolean;
  message: string;
}

export async function subscribeAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { success: false, message: "Enter a valid email address." };
  }
  const email = parsed.data.toLowerCase().trim();

  const existing = await db.subscriber.findUnique({ where: { email } });

  if (existing?.confirmed) {
    return { success: true, message: "You're already subscribed." };
  }

  const subscriber =
    existing ??
    (await db.subscriber.create({
      data: {
        email,
        confirmToken: randomToken(),
        unsubscribeToken: randomToken(),
      },
    }));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.wambugumartin.com";
  const confirmUrl = `${baseUrl}/api/subscribe/confirm?token=${subscriber.confirmToken}`;

  await sendMail({
    to: email,
    subject: "Confirm your Finance Insights subscription",
    text: `Confirm your subscription: ${confirmUrl}`,
    html: `<p>Confirm your subscription to the Finance Insights newsletter (sent twice weekly):</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
  });

  return { success: true, message: "Check your inbox to confirm your subscription." };
}
