"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyReveal } from "@/components/copy";
import { createRemoteApi, type KeyState } from "./actions";

export function CreateRemote() {
  const [state, action, pending] = useActionState<KeyState, FormData>(createRemoteApi, {});

  if (state.key && state.id) {
    return (
      <div className="panel space-y-4 p-5">
        <h2 className="font-bold">Đã tạo API remote</h2>
        <KeyReveal apiKey={state.key} />
        <Link href={`/dashboard/${state.id}`} className="btn btn-signal w-full">Thêm API con</Link>
      </div>
    );
  }

  return (
    <form action={action} className="panel space-y-4 p-5">
      <h2 className="font-bold">Tạo API remote</h2>
      <div>
        <label className="field-label" htmlFor="name">Tên</label>
        <input id="name" name="name" className="input" placeholder="Shop thời trang Hà Nội" required />
      </div>
      <div>
        <label className="field-label" htmlFor="description">Ghi chú (tuỳ chọn)</label>
        <input id="description" name="description" className="input" placeholder="Khách hàng A, kênh bán lẻ" />
      </div>
      {state.error && <p className="text-sm text-err" role="alert">{state.error}</p>}
      <button className="btn btn-signal w-full" disabled={pending}>{pending ? "Đang tạo…" : "Tạo và cấp API key"}</button>
    </form>
  );
}
