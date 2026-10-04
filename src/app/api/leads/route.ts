import { after } from "next/server";
import { saveLead, saveTriage } from "@/lib/leads";
import { notifyNewLead } from "@/lib/notify";
import { triageLead } from "@/lib/triage";
import { clientIp, rateLimit } from "@/lib/rate-limit";

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!rateLimit(`lead:${clientIp(request)}`, 5, 60 * 60_000)) {
    return Response.json({ error: "Too many requests. Please call us instead." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  // Honeypot: real visitors never see or fill this field.
  if (str(body.company, 200)) return Response.json({ ok: true });

  const lead = {
    name: str(body.name, 120),
    email: str(body.email, 200),
    phone: str(body.phone, 40),
    treatment: str(body.treatment, 80),
    preferredTime: str(body.preferredTime, 200),
    notes: str(body.notes, 1000),
    isNewPatient: body.isNewPatient !== false,
    transcript: str(body.transcript, 8000),
  };

  if (!lead.name) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!lead.email && !lead.phone) {
    return Response.json({ error: "Please add an email or phone number." }, { status: 400 });
  }
  if (lead.email && !EMAIL_RE.test(lead.email)) {
    return Response.json({ error: "Please check your email address." }, { status: 400 });
  }

  let id: string;
  try {
    id = await saveLead(lead);
  } catch (err) {
    console.error("Saving lead failed", err);
    return Response.json({ error: "Something went wrong. Please call us." }, { status: 500 });
  }
  // AI follow-up automation runs after the visitor already has their response.
  after(async () => {
    try {
      const triage = await triageLead(lead);
      await saveTriage(id, triage);
      await notifyNewLead(lead, triage);
    } catch (err) {
      console.error("Lead follow-up automation failed", err);
    }
  });

  return Response.json({ ok: true });
}
