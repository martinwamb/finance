import { NextResponse, type NextRequest } from "next/server";
import { createAdminSession, isAdminEmail } from "@/lib/auth";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://finance.wambugumartin.com").replace(
  /\/$/,
  ""
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/admin/login?error=google_cancelled", APP_URL));
  }

  let redirectTo = "/admin";
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      if (typeof decoded.from === "string" && decoded.from.startsWith("/")) {
        redirectTo = decoded.from;
      }
    }
  } catch {
    // ignore malformed state
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json();

    if (!googleUser.email) throw new Error("No email returned from Google");

    if (!isAdminEmail(googleUser.email)) {
      return NextResponse.redirect(new URL("/admin/login?error=not_admin", APP_URL));
    }

    await createAdminSession(googleUser.email);
    return NextResponse.redirect(new URL(redirectTo, APP_URL));
  } catch (err) {
    console.error("Google auth callback error:", err);
    return NextResponse.redirect(new URL("/admin/login?error=google_failed", APP_URL));
  }
}
