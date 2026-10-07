"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Sao chép", className = "btn btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Đã sao chép" : label}
    </button>
  );
}

export function KeyReveal({ apiKey }: { apiKey: string }) {
  return (
    <div className="rounded-lg border border-signal bg-[#fff8e5] p-4" role="status">
      <p className="text-sm font-semibold text-signal-ink">API key mới — lưu lại ngay, key chỉ hiện một lần.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-panel px-3 py-2 font-mono text-[13px]">{apiKey}</code>
        <CopyButton text={apiKey} className="btn" />
      </div>
    </div>
  );
}
