// Lead storage. Uses Supabase when SUPABASE_URL, SUPABASE_KEY (the public
// anon/publishable key) and SUPABASE_LEADS_SECRET are set (see
// supabase/schema.sql); otherwise keeps leads in memory so the demo works with
// zero setup. In-memory leads are lost on restart and are not shared between
// serverless functions, so production (e.g. Vercel) needs Supabase.

import "server-only";
import type { Priority, Triage } from "./triage";

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  treatment: string;
  preferredTime: string;
  notes: string;
  isNewPatient: boolean;
  transcript: string;
};

export type Lead = LeadInput & {
  id: string;
  createdAt: string;
  /** Null until the AI follow-up automation has triaged the lead. */
  triage: Triage | null;
};

// Kept on globalThis because Next.js bundles route handlers and pages
// separately; a plain module-level array would not be shared between them.
const store = globalThis as typeof globalThis & { __memoryLeads?: Lead[] };
const memoryLeads: Lead[] = (store.__memoryLeads ??= []);

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  const secret = process.env.SUPABASE_LEADS_SECRET;
  return url && key && secret ? { url: url.replace(/\/$/, ""), key, secret } : null;
}

export function storageMode(): "supabase" | "memory" {
  return supabaseConfig() ? "supabase" : "memory";
}

/** Calls a Postgres function through Supabase's REST API. */
async function rpc(fn: string, args: Record<string, unknown>): Promise<Response> {
  const sb = supabaseConfig()!;
  const headers: Record<string, string> = { apikey: sb.key, "Content-Type": "application/json" };
  // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys must not.
  if (sb.key.startsWith("eyJ")) headers.Authorization = `Bearer ${sb.key}`;
  const res = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_secret: sb.secret, ...args }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${fn} failed: ${res.status} ${await res.text()}`);
  return res;
}

type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  treatment: string;
  preferred_time: string;
  notes: string;
  is_new_patient: boolean;
  transcript: string;
  priority: Priority | null;
  ai_summary: string;
  ai_reason: string;
  reply_subject: string;
  reply_body: string;
};

/** Saves a lead and returns its id. */
export async function saveLead(input: LeadInput): Promise<string> {
  if (!supabaseConfig()) {
    const id = crypto.randomUUID();
    memoryLeads.unshift({ ...input, id, createdAt: new Date().toISOString(), triage: null });
    memoryLeads.splice(500);
    return id;
  }
  const res = await rpc("add_lead_v2", {
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_treatment: input.treatment,
    p_preferred_time: input.preferredTime,
    p_notes: input.notes,
    p_is_new_patient: input.isNewPatient,
    p_transcript: input.transcript,
  });
  return (await res.json()) as string;
}

export async function saveTriage(id: string, triage: Triage): Promise<void> {
  if (!supabaseConfig()) {
    const lead = memoryLeads.find((l) => l.id === id);
    if (lead) lead.triage = triage;
    return;
  }
  await rpc("update_lead_triage", {
    p_id: id,
    p_priority: triage.priority,
    p_ai_summary: triage.summary,
    p_ai_reason: triage.reason,
    p_reply_subject: triage.replySubject,
    p_reply_body: triage.replyBody,
  });
}

export async function listLeads(): Promise<Lead[]> {
  if (!supabaseConfig()) return memoryLeads;
  const rows = (await (await rpc("list_leads_v2", {})).json()) as LeadRow[];
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    name: r.name,
    email: r.email,
    phone: r.phone,
    treatment: r.treatment,
    preferredTime: r.preferred_time,
    notes: r.notes,
    isNewPatient: r.is_new_patient,
    transcript: r.transcript,
    triage: r.priority
      ? {
          priority: r.priority,
          summary: r.ai_summary,
          reason: r.ai_reason,
          replySubject: r.reply_subject,
          replyBody: r.reply_body,
        }
      : null,
  }));
}
