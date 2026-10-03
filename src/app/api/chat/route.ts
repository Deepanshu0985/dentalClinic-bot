import { alwaysInclude, retrieve, type Chunk } from "@/lib/knowledge";
import { hasMistralKey, streamChat, type ChatMessage } from "@/lib/mistral";
import { BOOKING_MARKER, buildSystemPrompt } from "@/lib/prompt";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { clinic } from "@/lib/clinic";

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): IncomingMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const parsed: IncomingMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return null;
    }
    // History comes from the browser, so the booking marker is stripped from it:
    // only the model's current reply may trigger the form.
    const content = m.content.replaceAll(BOOKING_MARKER, "").trim().slice(0, MAX_CHARS);
    if (!content) return null;
    parsed.push({ role: m.role, content });
  }
  return parsed.at(-1)?.role === "user" ? parsed : null;
}

function textStream(source: AsyncIterable<string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of source) controller.enqueue(encoder.encode(delta));
      } catch (err) {
        console.error("Chat stream failed", err);
        const busy = err instanceof Error && err.message.includes(" 429 ");
        controller.enqueue(
          encoder.encode(
            busy
              ? `\n\nI'm getting a lot of questions right now. Please try again in a moment, or call us at ${clinic.phone}.`
              : `\n\nSorry, I'm having trouble right now. Please call us at ${clinic.phone} and our team will help.`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function* single(text: string) {
  yield text;
}

export async function POST(request: Request) {
  if (!rateLimit(`chat:${clientIp(request)}`, 30, 10 * 60_000)) {
    return Response.json(
      { error: "Too many messages. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) return Response.json({ error: "Invalid messages." }, { status: 400 });

  if (!hasMistralKey()) {
    return textStream(
      single(
        "The AI assistant isn't configured yet: add `MISTRAL_API_KEY` to `.env.local` (or your Vercel project settings) and restart the server.",
      ),
    );
  }

  // Search with the last two user turns so follow-ups like "how much is it?" keep their topic.
  const userTurns = messages.filter((m) => m.role === "user").slice(-2);
  const retrieved = await retrieve(userTurns.map((m) => m.content).join("\n"));
  const context: Chunk[] = [...alwaysInclude, ...retrieved.filter((c) => !alwaysInclude.includes(c))];

  const prompt: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...messages.slice(-12),
  ];
  return textStream(streamChat(prompt, request.signal));
}
