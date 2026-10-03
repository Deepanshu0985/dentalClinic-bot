# Brightsmile Dental: AI Chatbot Demo

A demo website for a fictional dental clinic with an AI assistant ("Ava") that:

- **Answers questions from the clinic's own information** (prices, insurance, hours, policies, FAQ) using retrieval-augmented generation (RAG) with Mistral
- **Says "I'm not sure" instead of inventing answers**, and gives emergency guidance (including when to call 911)
- **Captures leads**: an appointment request form appears in the chat when a visitor wants to book
- **Shows leads in a password-protected dashboard** (`/dashboard`), including the chat transcript
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
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | No | Store leads in Supabase. Without them, leads are kept in memory and reset when the server restarts. |

## How it works

```
knowledge/*.md ──npm run ingest──▶ data/knowledge-index.json (chunks + mistral-embed vectors)

Visitor message ─▶ /api/chat ─▶ find the most relevant chunks
                              ─▶ Mistral chat (system prompt + chunks + conversation)
                              ─▶ streamed reply ─▶ chat widget
"I want to book" ─▶ reply ends with [[BOOKING_FORM]] ─▶ widget shows the form ─▶ /api/leads ─▶ /dashboard
```

- **Retrieval** (`src/lib/knowledge.ts`): uses embeddings when `data/knowledge-index.json` has them, otherwise falls back to keyword search, so the demo also runs before you've run `npm run ingest`. Opening hours, contact and location are always included.
- **Guardrails** (`src/lib/prompt.ts`): answers only from the clinic information, never confirms appointment times, no diagnoses, emergency escalation.
- **Cost protection** (`src/lib/rate-limit.ts`): per-IP limits on chat (30 messages / 10 min), lead submissions and dashboard logins; messages are capped at 1,000 characters.
- **Lead form spam protection**: a hidden honeypot field.

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

## Storing leads in Supabase (optional)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose it in the browser).

## Deploying to Vercel

1. Import this repo in Vercel.
2. Add the environment variables above in **Project Settings → Environment Variables**.
3. Deploy. Remember to run `npm run ingest` locally and commit `data/knowledge-index.json` so production uses semantic search.

## Notes

- Brightsmile Dental, its staff, address and phone number are fictional; the phone number uses the reserved 555-01xx range.
- The in-memory rate limiter and lead store are per server instance. For production, use Supabase for leads and a shared store (such as Upstash Redis) for rate limits.
