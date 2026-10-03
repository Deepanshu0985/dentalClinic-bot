// Builds data/knowledge-index.json from the markdown files in knowledge/.
//
// Each "## " section becomes one chunk. When MISTRAL_API_KEY is set, every
// chunk is embedded with mistral-embed so the chatbot can do semantic search.
// Without a key the index is still written (no embeddings) and the app falls
// back to keyword search, so the demo runs either way.
//
// Usage: npm run ingest   (reads MISTRAL_API_KEY from .env.local if present)

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
const OUT_FILE = path.join(ROOT, "data", "knowledge-index.json");
const EMBED_MODEL = "mistral-embed";

// Minimal .env.local loader so `npm run ingest` picks up MISTRAL_API_KEY.
const envFile = path.join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function chunkMarkdown(source, markdown) {
  const docTitle = markdown.match(/^# (.+)$/m)?.[1]?.trim() ?? source;
  const sections = markdown.split(/^## /m).slice(1);

  return sections.map((section, i) => {
    const [headingLine, ...body] = section.split("\n");
    const heading = headingLine.trim();
    return {
      id: `${source.replace(/\.md$/, "")}#${i + 1}`,
      source,
      title: `${docTitle} – ${heading}`,
      text: body.join("\n").trim(),
    };
  });
}

async function embed(texts, apiKey) {
  const res = await fetch(`${process.env.MISTRAL_API_BASE || "https://api.mistral.ai/v1"}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`Mistral embeddings failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

async function main() {
  const files = (await readdir(KNOWLEDGE_DIR)).filter((f) => f.endsWith(".md")).sort();
  const chunks = [];
  for (const file of files) {
    const markdown = await readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
    chunks.push(...chunkMarkdown(file, markdown));
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  let model = null;
  if (apiKey) {
    const inputs = chunks.map((c) => `${c.title}\n${c.text}`);
    const embeddings = [];
    // Small batches keep each request well under the API's input limits.
    for (let i = 0; i < inputs.length; i += 16) {
      embeddings.push(...(await embed(inputs.slice(i, i + 16), apiKey)));
    }
    chunks.forEach((c, i) => (c.embedding = embeddings[i]));
    model = EMBED_MODEL;
  } else {
    console.warn("MISTRAL_API_KEY not set: writing index without embeddings (keyword search only).");
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ model, generatedAt: new Date().toISOString(), chunks }, null, 2) + "\n",
  );
  console.log(`Wrote ${chunks.length} chunks to ${path.relative(ROOT, OUT_FILE)}${model ? ` (embedded with ${model})` : ""}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
