"use server";

import { redirect } from "next/navigation";
import { ADMIN_EMAIL, usernameToEmail } from "@/lib/auth-config";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };

const WRONG = "Sai tên đăng nhập hoặc mật khẩu.";

/** Đảm bảo tài khoản admin tồn tại với mật khẩu lấy từ ADMIN_PASSWORD (biến môi trường là nguồn gốc). */
async function syncAdminAccount(password: string) {
  const db = admin();
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = data?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  } else {
    await db.auth.admin.createUser({ email: ADMIN_EMAIL, password, email_confirm: true });
  }
}

export async function authAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = usernameToEmail(String(form.get("username") || ""));
  const password = String(form.get("password") || "");
  if (email !== ADMIN_EMAIL || !password) return { error: WRONG };

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword({ email, password });

  // Lần đăng nhập đầu, hoặc sau khi đổi ADMIN_PASSWORD trên Vercel: tạo/cập nhật tài khoản rồi thử lại
  if (error && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    try {
      await syncAdminAccount(password);
    } catch (e: any) {
      return { error: `Không khởi tạo được tài khoản admin: ${e?.message || e}` };
    }
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) return { error: WRONG };
  redirect("/dashboard");
}
