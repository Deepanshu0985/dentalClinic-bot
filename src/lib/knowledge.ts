// Retrieval over the clinic knowledge base (RAG).
// Uses mistral-embed vectors when the index has them, otherwise keyword scoring.

import index from "../../data/knowledge-index.json";
import { embedQuery, hasMistralKey } from "./mistral";

export type Chunk = {
  id: string;
  source: string;
  title: string;
  text: string;
  embedding?: number[];
};

const chunks = (index as { chunks: Chunk[] }).chunks;
const hasEmbeddings = chunks.length > 0 && chunks.every((c) => Array.isArray(c.embedding));

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const STOP_WORDS = new Set(
  "a an and are as at be but by can do does for from have how i if in is it me my of on or our so that the this to we what when where which who will with you your".split(
    " ",
  ),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$ ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    // Crude stemming so "implants"/"implant" and "cleaning"/"clean" match.
    .map((t) => t.replace(/(ing|es|s)$/, ""));
}

function keywordSearch(query: string, k: number): Chunk[] {
  const q = new Set(tokens(query));
  if (q.size === 0) return [];
  return chunks
    .map((chunk) => {
      const titleTokens = tokens(chunk.title);
      const bodyTokens = tokens(chunk.text);
      let score = 0;
      for (const t of q) {
        if (titleTokens.includes(t)) score += 3;
        score += bodyTokens.filter((b) => b === t).length;
      }
      return { chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.chunk);
}

export async function retrieve(query: string, k = 5): Promise<Chunk[]> {
  if (hasEmbeddings && hasMistralKey()) {
    try {
      const q = await embedQuery(query);
      return chunks
        .map((chunk) => ({ chunk, score: cosine(q, chunk.embedding!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((r) => r.chunk);
    } catch (err) {
      console.error("Embedding search failed, using keyword search", err);
    }
  }
  return keywordSearch(query, k);
}

/** Core facts always sent to the model, so basics like hours never depend on retrieval. */
export const alwaysInclude: Chunk[] = chunks.filter((c) =>
  /Opening hours|Contact$|Location and parking/.test(c.title),
);
