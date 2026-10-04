import type { Metadata } from "next";
import { cookies } from "next/headers";
import { listLeads, storageMode, type Lead } from "@/lib/leads";
import { COOKIE, sessionToken } from "@/lib/auth";
import type { Priority } from "@/lib/triage";
import { logout, triagePending } from "./actions";
import { CopyButton } from "./CopyButton";
import { LoginForm } from "./LoginForm";

const PRIORITY_STYLE: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 ring-red-200" },
  high_value: { label: "High value", className: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  routine: { label: "Routine", className: "bg-slate-100 text-slate-700 ring-slate-200" },
};
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high_value: 1, routine: 2 };

/** Urgent first, then high value, then routine; untriaged leads go to the top so they're noticed. */
function sortLeads(leads: Lead[]) {
  return [...leads].sort((a, b) => {
    const pa = a.triage ? PRIORITY_ORDER[a.triage.priority] : -1;
    const pb = b.triage ? PRIORITY_ORDER[b.triage.priority] : -1;
    return pa - pb || b.createdAt.localeCompare(a.createdAt);
  });
}

function mailto(lead: Lead) {
  if (!lead.email || !lead.triage) return null;
  const params = new URLSearchParams({ subject: lead.triage.replySubject, body: lead.triage.replyBody });
  return `mailto:${lead.email}?${params.toString().replace(/\+/g, "%20")}`;
}

export const metadata: Metadata = { title: "Leads · Brightsmile Dental", robots: { index: false } };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function countSince(leads: Lead[], ms: number) {
  const cutoff = Date.now() - ms;
  return leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff).length;
}

export default async function DashboardPage() {
  const token = sessionToken();
  const session = (await cookies()).get(COOKIE)?.value;

  if (!token || session !== token) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4">
        <LoginForm />
      </main>
    );
  }

  let leads: Lead[] = [];
  let loadError = "";
  try {
    leads = await listLeads();
  } catch (err) {
    console.error(err);
    loadError = "Could not load leads. Check your Supabase settings.";
  }

  const today = countSince(leads, 86_400_000);
  const urgent = leads.filter((l) => l.triage?.priority === "urgent").length;
  const highValue = leads.filter((l) => l.triage?.priority === "high_value").length;
  const pending = leads.filter((l) => !l.triage).length;

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Appointment requests</h1>
            <p className="text-xs text-slate-500">
              Captured by the website assistant · triaged by AI follow-up automation ·{" "}
              {storageMode() === "supabase" ? "stored in Supabase" : "in-memory demo storage (resets on restart)"}
            </p>
          </div>
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Total requests", leads.length],
            ["Last 24 hours", today],
            ["Urgent", urgent],
            ["High value", highValue],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {loadError && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

        {pending > 0 && (
          <form
            action={triagePending}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"
          >
            <span>
              {pending} request{pending === 1 ? " is" : "s are"} waiting for AI triage (new requests are usually done
              within a few seconds; refresh the page).
            </span>
            <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              Run AI triage now
            </button>
          </form>
        )}

        {leads.length === 0 && !loadError ? (
          <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
            No requests yet. Open the website, chat with the assistant and request an appointment.
          </p>
        ) : (
          <ul className="space-y-3">
            {sortLeads(leads).map((l) => (
              <li key={l.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {l.triage && (
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${PRIORITY_STYLE[l.triage.priority].className}`}
                        >
                          {PRIORITY_STYLE[l.triage.priority].label}
                        </span>
                      )}
                      {l.name}
                      {l.isNewPatient && (
                        <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                          New patient
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {[l.email, l.phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(l.createdAt)}</p>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-400">Treatment</dt>
                    <dd className="text-slate-800">{l.treatment || "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Preferred time</dt>
                    <dd className="text-slate-800">{l.preferredTime || "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Notes</dt>
                    <dd className="text-slate-800">{l.notes || "–"}</dd>
                  </div>
                </dl>
                {l.triage && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">AI summary</p>
                      <p className="mt-1 text-slate-800">{l.triage.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">Why this priority: {l.triage.reason}</p>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Drafted reply · review before sending
                        </p>
                        <div className="flex gap-2">
                          <CopyButton text={`${l.triage.replySubject}\n\n${l.triage.replyBody}`} />
                          {mailto(l) && (
                            <a
                              href={mailto(l)!}
                              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                            >
                              Open in email
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 font-medium text-slate-900">{l.triage.replySubject}</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{l.triage.replyBody}</p>
                    </div>
                  </div>
                )}
                {l.transcript && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-teal-700">View chat transcript</summary>
                    <pre className="mt-2 rounded-lg bg-slate-50 p-3 font-sans whitespace-pre-wrap text-slate-700">
                      {l.transcript}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
