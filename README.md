# AllInOne API

Web app kiểu upload-post.com: gom nhiều mạng xã hội vào **một API remote**.

- **API remote**: một endpoint có API key riêng (ví dụ mỗi khách hàng / thương hiệu một cái).
- **API con**: các tài khoản mạng xã hội nối vào một API remote (TikTok, YouTube, Instagram, Facebook Page, Threads, X, LinkedIn, Bluesky, Mastodon, Telegram, Discord, Slack).
- Gọi `POST /api/v1/post` một lần → đăng song song lên các API con được chọn, trả về kết quả từng kênh.

Stack: Next.js 16 (App Router) · Supabase (Auth, Postgres, Storage) · deploy Vercel.

---

## 1. Cài đặt

```bash
npm install
cp .env.example .env.local   # điền các biến
npm run dev
```

### Supabase
1. Tạo project tại supabase.com.
2. Mở **SQL Editor**, chạy toàn bộ `supabase/migrations/001_init.sql` (tạo bảng, RLS, bucket `media`).
3. Lấy URL + anon key + service role key ở **Project Settings → API** cho `.env.local`.
4. Không cần cấu hình email: app chạy chế độ **một người dùng**, tài khoản admin được tạo tự động ở lần đăng nhập đầu.

### Biến môi trường

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Bắt buộc |
| `SUPABASE_SERVICE_ROLE_KEY` | Bắt buộc, chỉ dùng phía server |
| `APP_URL` | URL gốc, ví dụ `https://allinone.vercel.app` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — mã hoá token của API con. **Mất key = mất toàn bộ kết nối.** |
| `CRON_SECRET` | Bảo vệ endpoint chạy bài hẹn giờ |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Tài khoản duy nhất được dùng web app. Đổi mật khẩu: sửa `ADMIN_PASSWORD` trên Vercel, redeploy, đăng nhập bằng mật khẩu mới |

### Deploy Vercel
Import repo vào Vercel, thêm các biến môi trường trên, deploy. `vercel.json` có sẵn cron chạy bài hẹn giờ **1 lần/ngày** (giới hạn gói Hobby). Muốn chạy mỗi phút: dùng cron-job.org (hoặc gói Pro) gọi

```
GET {APP_URL}/api/cron/scheduled   (header Authorization: Bearer CRON_SECRET)
```

---

## 2. Nối API con

Mọi API con đều kết nối bằng **key/token bạn tự dán** (không có luồng OAuth). Khi chọn một nền tảng trong form **Nối API con**, app hiện hướng dẫn từng bước kèm link tài liệu chính thức; toàn bộ hướng dẫn cũng có ở trang **Tài liệu API** (`/dashboard/docs#lay-token`). Nội dung nằm trong `lib/platforms/guides.ts`.

| Nền tảng | Cần dán |
|---|---|
| Telegram | Bot token + Chat ID |
| Discord / Slack | Webhook URL |
| Bluesky | Handle + App password |
| Mastodon | Instance URL + Access token |
| Facebook Page | Page ID + Page access token |
| Instagram | IG User ID + Access token |
| Threads | User ID + Access token |
| YouTube | OAuth Client ID/Secret + Refresh token (lấy qua Google OAuth Playground) — app tự đổi access token |
| TikTok | Client key/secret + Refresh token (365 ngày) — app tự đổi access token; trang `/tools/oauth-code` hiện mã code khi lấy token |
| LinkedIn | Access token (60 ngày, từ OAuth Token Generator) |
| X | API Key/Secret + Access Token/Secret (OAuth 1.0a, không hết hạn) |

Token được kiểm tra với nền tảng trước khi lưu, rồi mã hoá AES-256-GCM.

---

## 3. Gọi API

Header: `Authorization: Apikey aio_...`

### `POST /api/v1/post`

```json
{
  "text": "Nội dung / caption",
  "title": "Tiêu đề (YouTube)",
  "link": "https://...",
  "media": [{ "url": "https://.../clip.mp4", "type": "video" }, "https://.../anh.jpg"],
  "platforms": ["tiktok", "youtube-kenh-chinh"],
  "options": { "youtube": { "privacy": "unlisted", "tags": ["a"] }, "instagram": { "story": true } },
  "scheduled_at": "2026-10-10T09:00:00+07:00",
  "async": false
}
```

- `platforms`: tên nền tảng (đăng lên **mọi** tài khoản của nền tảng đó) hoặc `label` của một API con. Bỏ trống hoặc `["all"]` = mọi API con đang bật.
- `media`: URL công khai. Đuôi `.mp4/.mov/.webm` tự hiểu là video.
- `scheduled_at` ở tương lai → lưu trạng thái `scheduled`, cron sẽ đăng.
- `async: true` → trả `202` ngay, xem kết quả qua `GET /api/v1/posts/:id`.
- Cũng nhận **multipart** giống upload-post:

```bash
curl -X POST $APP_URL/api/v1/post \
  -H "Authorization: Apikey aio_xxx" \
  -F "text=Xin chào" -F "video=@clip.mp4" \
  -F "platform[]=tiktok" -F "platform[]=youtube"
```
File upload được lưu vào bucket Supabase `media` rồi chuyển URL cho các nền tảng.

Phản hồi:
```json
{
  "success": true, "post_id": "…", "status": "partial",
  "results": [
    { "label": "tiktok-shop-a", "platform": "tiktok", "ok": true, "id": "…", "ms": 8123 },
    { "label": "youtube-kenh-chinh", "platform": "youtube", "ok": false, "error": "HTTP 403: …" }
  ],
  "unknown_targets": []
}
```
`status`: `success` | `partial` | `failed` | `scheduled` | `processing`.

### Endpoint khác
| | |
|---|---|
| `GET /api/v1/me` | Kiểm tra key |
| `GET /api/v1/connections` | Danh sách API con |
| `GET /api/v1/posts?status=&limit=` | Lịch sử |
| `GET /api/v1/posts/:id` | Chi tiết + kết quả từng API con |
| `DELETE /api/v1/posts/:id` | Huỷ bài hẹn giờ |

---

## 4. Cấu trúc mã

```
lib/platforms/        connector từng mạng xã hội (thêm nền tảng mới: viết 1 PlatformDef, đăng ký ở index.ts)
lib/platforms/guides.ts  hướng dẫn lấy token từng nền tảng
lib/dispatch.ts       xác thực key, chọn API con, chạy song song, ghi log
lib/crypto.ts         AES-256-GCM cho credentials, sinh/hash API key
app/api/v1/*          API công khai
app/dashboard/docs    trang Tài liệu API
app/api/cron/*        chạy bài hẹn giờ
app/dashboard/*       giao diện quản lý API remote & API con
supabase/migrations   schema + RLS
```

## Bảo mật
- API key chỉ lưu dạng SHA-256; key thô hiện một lần khi tạo/cấp lại.
- Credentials API con mã hoá AES-256-GCM; trình duyệt không đọc được cột này (đã revoke quyền).
- RLS: mỗi user chỉ thấy dữ liệu của mình.

## Giới hạn của bản đầu & hướng mở rộng
- Video cho LinkedIn/X chưa hỗ trợ.
- Chưa có rate limit theo key, analytics, nhiều thành viên/team, whitelabel.
- Video rất lớn tải qua bộ nhớ function — với file > vài trăm MB nên chuyển sang hàng đợi (Inngest/QStash) hoặc worker riêng.
