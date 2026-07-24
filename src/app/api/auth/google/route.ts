import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") || "/admin";
  const state = Buffer.from(JSON.stringify({ from })).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
