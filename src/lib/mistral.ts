// Thin wrapper over the Mistral REST API (chat completions + embeddings).
// Plain fetch keeps the dependency surface small and the requests easy to read.

const API_BASE = process.env.MISTRAL_API_BASE || "https://api.mistral.ai/v1";

export const CHAT_MODEL = process.env.MISTRAL_CHAT_MODEL || "mistral-small-latest";
export const EMBED_MODEL = "mistral-embed";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function hasMistralKey(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY);
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
  };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

/**
 * POSTs to the Mistral API, retrying rate limits (429) and temporary server
 * errors with backoff. Free Mistral plans allow very few requests per second,
 * and each chat turn makes two calls (embedding + chat) back to back.
 */
async function mistralPost(
  path: string,
  body: unknown,
  { signal, delays = [1000, 2000, 4000] }: { signal?: AbortSignal; delays?: number[] } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal,
    });
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= delays.length) return res;

    const retryAfter = Number(res.headers.get("retry-after"));
    await res.body?.cancel();
    await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : delays[attempt], signal);
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  // No retries: if embeddings are rate limited, retrieval falls back to keyword
  // search right away and the request budget is saved for the chat reply.
  const res = await mistralPost("/embeddings", { model: EMBED_MODEL, input: [text] }, { delays: [] });
  if (!res.ok) throw new Error(`Mistral embeddings failed: ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

/**
 * Streams a chat completion and yields the text deltas as they arrive.
 * Mistral uses server-sent events: `data: {json}` lines ending with `data: [DONE]`.
 */
export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await mistralPost(
    "/chat/completions",
    { model: CHAT_MODEL, messages, temperature: 0.3, max_tokens: 600, stream: true },
    { signal },
  );
  if (!res.ok || !res.body) {
    throw new Error(`Mistral chat failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // Ignore keep-alive or partial lines.
      }
    }
  }
}
