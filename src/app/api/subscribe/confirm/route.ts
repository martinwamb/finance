import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/", request.url));

  const subscriber = await db.subscriber.findUnique({ where: { confirmToken: token } });
  if (subscriber && !subscriber.confirmed) {
    await db.subscriber.update({
      where: { id: subscriber.id },
      data: { confirmed: true, confirmedAt: new Date() },
    });
  }

  return NextResponse.redirect(new URL("/subscribed", request.url));
}
