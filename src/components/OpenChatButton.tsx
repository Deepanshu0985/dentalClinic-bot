"use client";

import { OPEN_EVENT } from "./ChatWidget";

export function OpenChatButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}
