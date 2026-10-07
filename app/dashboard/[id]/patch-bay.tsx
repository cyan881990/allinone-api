"use client";

import { useState, useTransition } from "react";
import { checkConnection, deleteConnection, setConnectionEnabled } from "../actions";

export type ConnView = {
  id: string;
  platform: string;
  platformName: string;
  color: string;
  label: string;
  display_name: string | null;
  enabled: boolean;
  status: string;
  last_error: string | null;
};

const ROW = 68;

/** Sơ đồ nối dây: API remote bên trái, mỗi dây là một API con */
export function PatchBay({ remoteName, connections }: { remoteName: string; connections: ConnView[] }) {
  if (connections.length === 0) {
    return (
      <div className="panel mt-3 p-8 text-center">
        <p className="font-semibold">Chưa nối API con nào</p>
        <p className="mt-1 text-sm text-muted">Chọn một nền tảng ở khung bên phải để nối tài khoản đầu tiên.</p>
      </div>
    );
  }
  const h = connections.length * ROW;
  return (
    <div className="panel mt-3 flex overflow-hidden p-4">
      <div className="hidden w-36 shrink-0 items-center sm:flex">
        <div className="w-full rounded-lg bg-ink px-3 py-3 text-[13px] font-semibold leading-snug text-white">{remoteName}</div>
      </div>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="hidden w-14 shrink-0 sm:block" style={{ height: h }} aria-hidden>
        {connections.map((c, i) => {
          const y = i * ROW + ROW / 2;
          const stroke = !c.enabled ? "#c3cad6" : c.status === "error" ? "#d64545" : c.color;
          return (
            <path
              key={c.id}
              d={`M0 ${h / 2} C 60 ${h / 2}, 40 ${y}, 100 ${y}`}
              fill="none"
              stroke={stroke}
              strokeWidth={c.enabled ? 2 : 1.2}
              strokeDasharray={c.enabled ? undefined : "4 4"}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <ul className="min-w-0 flex-1">
        {connections.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </ul>
    </div>
  );
}

function Row({ c }: { c: ConnView }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const lamp = !c.enabled ? "lamp-off" : c.status === "error" ? "lamp-err" : "lamp-ok";
  const note = msg?.error || msg?.ok || (c.status === "error" && c.last_error) || null;

  return (
    <li className="flex items-center gap-3" style={{ minHeight: ROW }}>
      <span className={`lamp ${lamp}`} title={!c.enabled ? "Đang tắt" : c.status === "error" ? "Lỗi" : "Hoạt động"} />
      <div className="min-w-0 flex-1 border-l-[3px] pl-3" style={{ borderColor: c.color, opacity: c.enabled ? 1 : 0.55 }}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[13.5px] font-medium">{c.label}</span>
          <span className="text-[13px] text-muted">{c.platformName}{c.display_name ? ` · ${c.display_name}` : ""}</span>
        </div>
        {note && <p className={`truncate text-[12.5px] ${msg?.ok ? "text-ok" : "text-err"}`} title={note}>{note}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          className="btn btn-ghost !px-2.5 !py-1 text-[13px]"
          disabled={pending}
          onClick={() => start(async () => setMsg(await checkConnection(c.id)))}
        >
          Kiểm tra
        </button>
        <button className="btn btn-ghost !px-2.5 !py-1 text-[13px]" disabled={pending} onClick={() => start(() => setConnectionEnabled(c.id, !c.enabled))}>
          {c.enabled ? "Tắt" : "Bật"}
        </button>
        <button
          className="btn btn-danger !px-2.5 !py-1 text-[13px]"
          disabled={pending}
          onClick={() => confirm(`Gỡ API con "${c.label}"?`) && start(() => deleteConnection(c.id))}
        >
          Gỡ
        </button>
      </div>
    </li>
  );
}
