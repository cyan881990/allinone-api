"use server";

import { redirect } from "next/navigation";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function authAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const mode = form.get("mode") === "signup" ? "signup" : "signin";
  if (!email || password.length < 6) return { error: "Nhập email và mật khẩu tối thiểu 6 ký tự." };

  const supabase = await createClient();
  if (mode === "signup") {
    if (process.env.ALLOW_SIGNUP === "false") return { error: "Đăng ký tài khoản mới đang tắt." };
    // Tạo tài khoản đã xác nhận (không phụ thuộc email SMTP của Supabase)
    const { error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      return { error: exists ? "Email này đã có tài khoản, hãy đăng nhập." : error.message };
    }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu." : error.message };
  redirect("/dashboard");
}
