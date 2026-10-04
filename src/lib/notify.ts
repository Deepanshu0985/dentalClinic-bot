// Optional staff alert for new leads. Set LEAD_WEBHOOK_URL to a Slack or
// Discord incoming-webhook URL; without it, notifications are skipped.

import "server-only";
import type { LeadInput } from "./leads";
import type { Triage } from "./triage";

const LABEL: Record<Triage["priority"], string> = {
  urgent: "🔴 URGENT",
  high_value: "🟢 High value",
  routine: "⚪ Routine",
};

export async function notifyNewLead(lead: LeadInput, triage: Triage): Promise<void> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;

  const contact = [lead.email, lead.phone].filter(Boolean).join(" · ");
  const text = `${LABEL[triage.priority]} new appointment request: ${lead.name} (${contact})\n${triage.summary}\nWhy: ${triage.reason}`;
  // Slack reads `text`, Discord reads `content`; each ignores the other.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
  });
  if (!res.ok) throw new Error(`Lead webhook failed: ${res.status}`);
}
