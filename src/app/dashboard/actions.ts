"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { COOKIE, digest, sessionToken } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { listLeads, saveTriage } from "@/lib/leads";
import { triageLead } from "@/lib/triage";

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return "Set DASHBOARD_PASSWORD in your environment to enable the dashboard.";

  const ip = clientIp(new Request("http://local", { headers: await headers() }));
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) return "Too many attempts. Try again later.";

  const attempt = String(formData.get("password") ?? "");
  if (!timingSafeEqual(digest(attempt), digest(password))) return "Wrong password.";

  (await cookies()).set(COOKIE, sessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/dashboard",
    maxAge: 60 * 60 * 12,
  });
  redirect("/dashboard");
}

export async function logout() {
  (await cookies()).delete({ name: COOKIE, path: "/dashboard" });
  redirect("/dashboard");
}

/** Runs the AI follow-up automation for leads that don't have a triage yet (e.g. older leads). */
export async function triagePending() {
  // Server actions are public endpoints, so check the session here too.
  const session = (await cookies()).get(COOKIE)?.value;
  if (!session || session !== sessionToken()) return;

  const pending = (await listLeads()).filter((l) => !l.triage).slice(0, 10);
  for (const lead of pending) {
    await saveTriage(lead.id, await triageLead(lead));
  }
  revalidatePath("/dashboard");
}
