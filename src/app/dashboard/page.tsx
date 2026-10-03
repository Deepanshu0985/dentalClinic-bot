import type { Metadata } from "next";
import { cookies } from "next/headers";
import { listLeads, storageMode, type Lead } from "@/lib/leads";
import { COOKIE, sessionToken } from "@/lib/auth";
import { logout } from "./actions";
import { LoginForm } from "./LoginForm";

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

  const newPatients = leads.filter((l) => l.isNewPatient).length;
  const today = countSince(leads, 86_400_000);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Appointment requests</h1>
            <p className="text-xs text-slate-500">
              Captured by the website assistant ·{" "}
              {storageMode() === "supabase" ? "stored in Supabase" : "in-memory demo storage (resets on restart)"}
            </p>
          </div>
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Total requests", leads.length],
            ["Last 24 hours", today],
            ["New patients", newPatients],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {loadError && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

        {leads.length === 0 && !loadError ? (
          <p className="rounded-2xl bg-white p-10 text-center text-slate-500 ring-1 ring-slate-200">
            No requests yet. Open the website, chat with the assistant and request an appointment.
          </p>
        ) : (
          <ul className="space-y-3">
            {leads.map((l) => (
              <li key={l.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
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
