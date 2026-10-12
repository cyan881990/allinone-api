import { NextResponse } from "next/server";

/**
 * Deauthorize callback của Meta: gọi khi người dùng gỡ app khỏi Instagram.
 * Token tương ứng sẽ tự mất hiệu lực; lần đăng tiếp theo API con chuyển sang trạng thái lỗi
 * để chủ web app thấy và gỡ/kết nối lại. Chỉ cần trả 200.
 */
export async function POST() {
  return NextResponse.json({ success: true });
}
