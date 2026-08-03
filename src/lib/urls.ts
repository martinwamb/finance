import type { NextRequest } from "next/server";

// The app sits behind nginx, so `request.url` carries the internal origin
// (http://localhost:3005) rather than the public one. Redirects built from it
// send people to a dead localhost address — which is exactly where the
// subscribe-confirmation and newsletter unsubscribe links used to point.
// NEXT_PUBLIC_APP_URL is the canonical public origin; fall back to the request
// only when it isn't configured (local development).
export function appUrl(path: string, request?: NextRequest): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) return new URL(path, base);
  return new URL(path, request?.url ?? "http://localhost:3005");
}
