import type { Metadata } from "next";
import { ChatWidget } from "@/components/ChatWidget";

// Chat-only page loaded inside the iframe that public/widget.js adds to any website.
export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export default function EmbedPage() {
  return <ChatWidget embedded />;
}
