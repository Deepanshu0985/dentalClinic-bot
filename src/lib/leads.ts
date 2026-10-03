// Lead storage. Uses Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are set (see supabase/schema.sql); otherwise keeps leads in memory so the
// demo works with zero setup (in-memory leads reset when the server restarts).

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export function storageMode(): "supabase" | "memory" {
  return supabaseConfig() ? "supabase" : "memory";
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
  const sb = supabaseConfig();
  if (!sb) {
    memoryLeads.unshift({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    memoryLeads.splice(500);
    return;
  }
  const res = await fetch(`${sb.url}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      treatment: input.treatment,
      preferred_time: input.preferredTime,
      notes: input.notes,
      is_new_patient: input.isNewPatient,
      transcript: input.transcript,
    }),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${res.status} ${await res.text()}`);
}

export async function listLeads(): Promise<Lead[]> {
  const sb = supabaseConfig();
  if (!sb) return memoryLeads;
  const res = await fetch(`${sb.url}/rest/v1/leads?select=*&order=created_at.desc&limit=200`, {
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as LeadRow[];
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
