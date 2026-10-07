"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy";

export function CodeTabs({ tabs }: { tabs: { id: string; label: string; code: string }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const tab = tabs.find((t) => t.id === active)!;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-line bg-panel p-0.5 text-[13px]" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={`rounded px-2.5 py-1 font-medium ${active === t.id ? "bg-ink text-white" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={tab.code} className="btn btn-ghost !py-1 text-[13px]" />
      </div>
      <pre className="code mt-2" role="tabpanel">{tab.code}</pre>
    </div>
  );
}
