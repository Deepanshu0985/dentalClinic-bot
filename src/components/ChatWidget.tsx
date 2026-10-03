"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clinic, treatments } from "@/lib/clinic";

const BOOKING_MARKER = "[[BOOKING_FORM]]";
export const OPEN_EVENT = "brightsmile-chat:open";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  showBookingForm?: boolean;
};

const QUICK_REPLIES = [
  "How much is teeth whitening?",
  "Do you accept my insurance?",
  "I have a toothache",
  "Book an appointment",
];

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: `Hi! I'm ${clinic.assistantName}, ${clinic.name}'s virtual assistant. I can answer questions about treatments, prices, insurance and opening hours, or help you request an appointment. How can I help?`,
};

/** Removes the booking marker, including a half-streamed "[[BOOK..." at the end. */
function stripMarker(text: string): { clean: string; hasMarker: boolean } {
  const hasMarker = text.includes(BOOKING_MARKER);
  let clean = text.replaceAll(BOOKING_MARKER, "");
  const partial = clean.lastIndexOf("[[");
  if (partial !== -1 && BOOKING_MARKER.startsWith(clean.slice(partial))) {
    clean = clean.slice(0, partial);
  }
  return { clean: clean.trimEnd(), hasMarker };
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/** Minimal, safe formatting for bot replies: paragraphs, bullet lists and **bold**. */
function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

export function ChatWidget({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Lets other buttons on the page (e.g. "Chat with Ava") open the widget.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    if (embedded) window.parent.postMessage({ type: "brightsmile-chat:close" }, "*");
    else setOpen(false);
  }

  function update(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };

    // Booking requests open the form right away, no model round-trip needed.
    if (/^book an appointment$/i.test(content)) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Happy to help! Fill in the form below and our front desk will confirm your appointment within one business day.",
          showBookingForm: true,
        },
      ]);
      return;
    }

    const botId = crypto.randomUUID();
    const history = [...messages, userMsg]
      .filter((m) => m.id !== GREETING.id)
      .map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMsg, { id: botId, role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let raw = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Request failed");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += value;
        update(botId, { content: stripMarker(raw).clean });
      }
      const { clean, hasMarker } = stripMarker(raw);
      update(botId, {
        // Never leave an empty bubble (the typing dots) if the model returned nothing.
        content:
          clean ||
          (hasMarker
            ? "Please fill in the form below and our front desk will confirm your appointment."
            : `Sorry, I didn't catch that. Could you rephrase, or call us at ${clinic.phone}?`),
        showBookingForm: hasMarker,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      update(botId, {
        content:
          err instanceof Error && err.message !== "Request failed"
            ? err.message
            : `Sorry, something went wrong. Please try again or call us at ${clinic.phone}.`,
      });
    } finally {
      setStreaming(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const transcript = messages
    .filter((m) => m.content)
    .map((m) => `${m.role === "user" ? "Visitor" : clinic.assistantName}: ${m.content}`)
    .join("\n");

  const showQuickReplies = messages.length === 1;

  const panel = (
    <div
      className={
        embedded
          ? "flex h-dvh w-full flex-col bg-white"
          : "fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:h-[620px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-2xl"
      }
      role="dialog"
      aria-label={`Chat with ${clinic.assistantName}`}
    >
      <header className="flex items-center gap-3 bg-teal-700 px-4 py-3 text-white">
        <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg font-semibold">
          {clinic.assistantName[0]}
          <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-teal-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="leading-tight font-semibold">{clinic.assistantName} · {clinic.name}</p>
          <p className="text-xs text-teal-100">Virtual assistant · replies instantly</p>
        </div>
        <button
          onClick={close}
          className="rounded-full p-2 text-teal-100 hover:bg-white/10 hover:text-white"
          aria-label="Close chat"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id}>
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-teal-700 text-white"
                    : "rounded-bl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                }`}
              >
                {m.content ? (
                  m.role === "assistant" ? <FormattedText text={m.content} /> : m.content
                ) : (
                  <span className="flex gap-1 py-1" aria-label="Typing">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
            {m.showBookingForm && <BookingForm transcript={transcript} />}
          </div>
        ))}

        {showQuickReplies && (
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:border-teal-400 hover:bg-teal-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Type your question…"
            className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-40"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          AI assistant · can make mistakes · emergencies: call {clinic.phone}
        </p>
      </form>
    </div>
  );

  if (embedded) return panel;

  return (
    <>
      {open && panel}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed right-6 bottom-6 z-50 h-14 items-center gap-2 rounded-full bg-teal-700 pr-5 pl-4 text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-800 ${
          open ? "hidden sm:flex" : "flex"
        }`}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path
              d="M8 10h8M8 14h5M21 12a9 9 0 01-13.3 7.9L3 21l1.1-4.7A9 9 0 1121 12z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="text-sm font-semibold">{open ? "Close" : "Ask us anything"}</span>
      </button>
    </>
  );
}

function BookingForm({ transcript }: { transcript: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          treatment: data.get("treatment"),
          preferredTime: data.get("preferredTime"),
          notes: data.get("notes"),
          isNewPatient: data.get("isNewPatient") === "on",
          company: data.get("company"),
          transcript,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <p className="font-semibold">✓ Request received</p>
        <p className="mt-1">
          Thank you! Our front desk will contact you within one business day to confirm your appointment.
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 space-y-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <p className="text-sm font-semibold text-slate-900">Request an appointment</p>
      <input name="name" required placeholder="Full name *" autoComplete="name" className={field} />
      <input name="email" type="email" placeholder="Email" autoComplete="email" className={field} />
      <input name="phone" type="tel" placeholder="Phone" autoComplete="tel" className={field} />
      <select name="treatment" defaultValue="" className={field} aria-label="Treatment">
        <option value="" disabled>
          What do you need?
        </option>
        {treatments.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input
        name="preferredTime"
        placeholder="Preferred day/time (e.g. Tue morning)"
        className={field}
      />
      <textarea name="notes" rows={2} placeholder="Anything we should know? (optional)" className={field} />
      {/* Honeypot for bots; hidden from people and assistive tech. */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input name="isNewPatient" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-700" />
        I&apos;m a new patient
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request appointment"}
      </button>
      <p className="text-[11px] text-slate-400">Email or phone required. We never share your details.</p>
    </form>
  );
}
