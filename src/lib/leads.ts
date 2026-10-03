// Lead storage. Uses Supabase when SUPABASE_URL, SUPABASE_KEY (the public
// anon/publishable key) and SUPABASE_LEADS_SECRET are set (see
// supabase/schema.sql); otherwise keeps leads in memory so the demo works with
// zero setup. In-memory leads are lost on restart and are not shared between
// serverless functions, so production (e.g. Vercel) needs Supabase.

import "server-only";

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

export type Lead = LeadInput & { id: string; createdAt: string };

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
};

export async function saveLead(input: LeadInput): Promise<void> {
  if (!supabaseConfig()) {
    memoryLeads.unshift({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    memoryLeads.splice(500);
    return;
  }
  await rpc("add_lead", {
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_treatment: input.treatment,
    p_preferred_time: input.preferredTime,
    p_notes: input.notes,
    p_is_new_patient: input.isNewPatient,
    p_transcript: input.transcript,
  });
}

export async function listLeads(): Promise<Lead[]> {
  if (!supabaseConfig()) return memoryLeads;
  const rows = (await (await rpc("list_leads", {})).json()) as LeadRow[];
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
  }));
}
