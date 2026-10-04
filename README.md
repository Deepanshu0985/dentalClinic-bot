# Brightsmile Dental: AI Chatbot Demo

A demo website for a fictional dental clinic with an AI assistant ("Ava") that:

- **Answers questions from the clinic's own information** (prices, insurance, hours, policies, FAQ) using retrieval-augmented generation (RAG) with Mistral
- **Says "I'm not sure" instead of inventing answers**, and gives emergency guidance (including when to call 911)
- **Captures leads**: an appointment request form appears in the chat when a visitor wants to book
- **AI lead follow-up automation**: every request is triaged by AI (urgent / high value / routine), summarised, and gets a drafted reply email the front desk can review and send in one click; optional Slack/Discord alert via `LEAD_WEBHOOK_URL`
- **Shows leads in a password-protected dashboard** (`/dashboard`), urgent first, with the AI summary, drafted reply and chat transcript
- **Installs on any website with one line** of code (`public/widget.js`)

Built with Next.js 16, TypeScript, Tailwind CSS and the Mistral API (`mistral-small-latest` for chat, `mistral-embed` for search).

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in MISTRAL_API_KEY and DASHBOARD_PASSWORD
npm run ingest               # embeds the knowledge base with mistral-embed
npm run dev
```

Open http://localhost:3000 and click **Chat with Ava**. Leads appear at http://localhost:3000/dashboard.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MISTRAL_API_KEY` | Yes | Mistral API key from https://console.mistral.ai |
| `DASHBOARD_PASSWORD` | Yes, for `/dashboard` | Password for the leads dashboard |
| `MISTRAL_CHAT_MODEL` | No | Chat model, default `mistral-small-latest` |
| `LEAD_WEBHOOK_URL` | No | Slack or Discord incoming-webhook URL for new-lead alerts |
| `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_LEADS_SECRET` | Yes on Vercel | Store leads in Supabase. Without them, leads are kept in memory: fine locally, but on Vercel the chat and the dashboard run as separate functions and won't see each other's leads. |

## How it works

```
knowledge/*.md ──npm run ingest──▶ data/knowledge-index.json (chunks + mistral-embed vectors)

Visitor message ─▶ /api/chat ─▶ find the most relevant chunks
                              ─▶ Mistral chat (system prompt + chunks + conversation)
                              ─▶ streamed reply ─▶ chat widget
"I want to book" ─▶ reply ends with [[BOOKING_FORM]] ─▶ widget shows the form ─▶ /api/leads ─▶ /dashboard
                                                     └─ after response: AI triage + drafted reply (+ webhook alert)
```

- **Retrieval** (`src/lib/knowledge.ts`): uses embeddings when `data/knowledge-index.json` has them, otherwise falls back to keyword search, so the demo also runs before you've run `npm run ingest`. Opening hours, contact and location are always included.
- **Guardrails** (`src/lib/prompt.ts`): answers only from the clinic information, never confirms appointment times, no diagnoses or medication doses, emergency escalation (911), no discounts or price matching, stays on topic, and refuses prompt-injection attempts. Conversation history from the browser is validated and the booking marker is stripped from it, so only the model's current reply can open the form.
- **Cost protection** (`src/lib/rate-limit.ts`): per-IP limits on chat (30 messages / 10 min), lead submissions and dashboard logins; messages are capped at 1,000 characters.
- **Lead form spam protection**: a hidden honeypot field.
- **Follow-up automation** (`src/lib/triage.ts`): runs after the response with Next.js `after()`, asks Mistral for a JSON triage and drafted email, and falls back to keyword rules if AI is unavailable. The rules can upgrade a lead to urgent but the AI can never downgrade an urgent one.

## Testing the bot's behaviour

With the dev server running (`npm run dev`) and a real `MISTRAL_API_KEY`, run:

```bash
npm run eval
```

It sends 19 test conversations (prices, insurance, booking, emergencies, diagnosis, medication, unknown services, price matching, off-topic, prompt injection, Spanish, follow-ups) and prints which replies pass their checks, with the full reply for any failure. LLM replies vary, so read failures before changing the prompt.

## Changing the knowledge base

Edit the markdown files in `knowledge/`. Each `## ` heading becomes one searchable chunk. Then run:

```bash
npm run ingest
```

and commit the updated `data/knowledge-index.json`.

## Re-skinning for another business

1. Replace the files in `knowledge/` with the new business's information.
2. Update `src/lib/clinic.ts` (name, phone, hours, assistant name, form options).
3. Update the landing page content in `src/app/page.tsx` and the system prompt in `src/lib/prompt.ts`.
4. Run `npm run ingest`.

## Embedding on another website

After deploying, add this before `</body>` on any website:

```html
<script src="https://YOUR-DEPLOYMENT.vercel.app/widget.js" defer></script>
```

Optional attributes: `data-color="#0f766e"` (button color) and `data-label="Ask us anything"` (button text). The chat loads in an iframe from `/embed` only when the visitor first opens it.

## Storing leads in Supabase

Required for Vercel or any serverless host.

1. Create a Supabase project.
2. Pick a long random secret and get its SHA-256:
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<your-secret>"
   ```
3. Put the hash into `supabase/schema.sql` (replace `<sha256-of-your-secret>`) and run the file in the SQL editor.
4. Set `SUPABASE_URL`, `SUPABASE_KEY` (the publishable/anon key) and `SUPABASE_LEADS_SECRET` (the secret itself).

The `leads` table has row level security on with no policies, so the public key alone can't read or write it. The app only uses the database functions `add_lead_v2`, `update_lead_triage` and `list_leads_v2`, which reject calls without the secret.

## Deploying to Vercel

1. Import this repo in Vercel.
2. Add the environment variables above in **Project Settings → Environment Variables**.
3. Deploy. Remember to run `npm run ingest` locally and commit `data/knowledge-index.json` so production uses semantic search.

## Notes

- Brightsmile Dental, its staff, address and phone number are fictional; the phone number uses the reserved 555-01xx range.
- The in-memory rate limiter is per server instance. For high-traffic production, use a shared store (such as Upstash Redis) for rate limits.
