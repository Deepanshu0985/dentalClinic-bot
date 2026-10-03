import "server-only";
import { createHash } from "node:crypto";

export const COOKIE = "dashboard_session";

export function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** The session cookie holds a hash of the password, never the password itself. */
export function sessionToken(): string | null {
  const password = process.env.DASHBOARD_PASSWORD;
  return password ? digest(`dashboard:${password}`).toString("hex") : null;
}
