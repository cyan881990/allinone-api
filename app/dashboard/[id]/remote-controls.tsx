"use client";

import { useState, useTransition } from "react";
import { KeyReveal } from "@/components/copy";
import { deleteRemote, rotateKey, setRemoteActive, updateRemote } from "../actions";

type Remote = { id: string; name: string; description: string | null; key_prefix: string; active: boolean };

export function RemoteControls({ remote }: { remote: Remote }) {
  const [editing, setEditing] = useState(false);
  const [newKey, setNewKey] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="mt-2 space-y-4">
      {editing ? (
        <form
          action={async (f) => {
            await updateRemote(remote.id, f);
            setEditing(false);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="rn">Tên</label>
            <input id="rn" name="name" defaultValue={remote.name} className="input" />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="rd">Ghi chú</label>
            <input id="rd" name="description" defaultValue={remote.description || ""} className="input" />
          </div>
          <button className="btn">Lưu</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Huỷ</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <span className={`lamp ${remote.active ? "lamp-ok" : "lamp-off"}`} />
              {remote.name}
            </h1>
            {remote.description && <p className="text-muted">{remote.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>Đổi tên</button>
            <button className="btn btn-ghost" disabled={pending} onClick={() => start(() => setRemoteActive(remote.id, !remote.active))}>
              {remote.active ? "Tạm dừng API" : "Bật lại API"}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`Xoá "${remote.name}" cùng toàn bộ API con và lịch sử? Không hoàn tác được.`)) start(() => deleteRemote(remote.id));
              }}
            >
              Xoá
            </button>
          </div>
        </div>
      )}

      <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="text-sm">
          <span className="font-semibold">API key</span>
          <span className="ml-3 font-mono text-muted">{remote.key_prefix}••••••••••••</span>
          {!remote.active && <span className="ml-3 text-err">Đang tạm dừng — mọi request bị từ chối</span>}
        </div>
        <button
          className="btn btn-ghost !py-1.5"
          disabled={pending}
          onClick={() => {
            if (!confirm("Cấp key mới? Key cũ ngừng hoạt động ngay lập tức.")) return;
            start(async () => {
              const r = await rotateKey(remote.id);
              if (r.key) setNewKey(r.key);
            });
          }}
        >
          Cấp lại key
        </button>
      </div>
      {newKey && <KeyReveal apiKey={newKey} />}
    </div>
  );
}
