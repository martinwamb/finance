import { randomBytes } from "node:crypto";

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
