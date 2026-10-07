import Link from "next/link";
import { PlatformGuideView } from "@/components/platform-guide";
import { PLATFORMS } from "@/lib/platforms";
import { GUIDES } from "@/lib/platforms/guides";
import { admin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { CodeTabs } from "./code-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tài liệu API — AllInOne API" };

const TOC = [
  ["tong-quan", "Tổng quan"],
  ["xac-thuc", "Xác thực"],
  ["dang-bai", "POST /post — Đăng bài"],
  ["chon-api-con", "Chọn API con"],
  ["options", "Tuỳ chọn theo nền tảng"],
  ["phan-hoi", "Phản hồi"],
  ["lich-su", "Lịch sử & hẹn giờ"],
  ["endpoint-khac", "Endpoint khác"],
  ["ma-loi", "Mã lỗi"],
  ["gioi-han", "Nền tảng hỗ trợ"],
  ["lay-token", "Lấy token cho API con"],
] as const;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 border-t border-line pt-10 text-xl font-bold tracking-tight first:border-0 first:pt-0">
      <a href={`#${id}`} className="hover:underline">{children}</a>
    </h2>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <thead className="bg-paper text-[13px] text-muted">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line bg-panel">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => <code className="inline">{children}</code>;
const Pre = ({ children }: { children: string }) => <pre className="code mt-3">{children}</pre>;

export default async function DocsPage() {
  const user = await requireUser();
  const base = (process.env.APP_URL || "https://your-app.vercel.app").replace(/\/$/, "");
  const { data: conns } = await admin().from("connections").select("label, platform").eq("owner_id", user.id).eq("enabled", true).limit(3);
  const ex = conns?.length ? [conns[0].platform, ...(conns[1] ? [conns[1].label] : [])] : ["tiktok", "youtube-kenh-chinh"];

  const body = {
    text: "Ra mắt bộ sưu tập thu 2026 🍂",
    media: [{ url: "https://cdn.example.com/teaser.mp4", type: "video" }],
    platforms: ex,
  };
  const examples = {
    curl: `curl -X POST ${base}/api/v1/post \\
  -H "Authorization: Apikey aio_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`,
    js: `const res = await fetch("${base}/api/v1/post", {
  method: "POST",
  headers: {
    Authorization: "Apikey " + process.env.AIO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}),
});
const data = await res.json();
if (!data.success) console.error(data.error ?? data.results);`,
    python: `import os, requests

r = requests.post(
    "${base}/api/v1/post",
    headers={"Authorization": "Apikey " + os.environ["AIO_API_KEY"]},
    json=${JSON.stringify(body, null, 4).replace(/\n/g, "\n    ").replace(/"/g, '"')},
    timeout=300,
)
print(r.status_code, r.json())`,
    multipart: `curl -X POST ${base}/api/v1/post \\
  -H "Authorization: Apikey aio_xxxxxxxx" \\
  -F "text=Video mới" \\
  -F "video=@/duong-dan/clip.mp4" \\
  -F "platform[]=tiktok" \\
  -F "platform[]=youtube" \\
  -F 'options={"youtube":{"privacy":"unlisted"}}'`,
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Mục lục" className="hidden lg:block">
        <div className="sticky top-6 space-y-1 text-[14px]">
          <p className="mb-2 font-bold">Tài liệu API</p>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded px-2 py-1 text-muted hover:bg-panel hover:text-ink">{label}</a>
          ))}
        </div>
      </nav>

      <article className="max-w-3xl space-y-5 [&_p]:max-w-[68ch]">
        <header>
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">Bảng điều khiển</Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Tài liệu API remote</h1>
          <p className="mt-2 text-muted">Một request đăng bài lên nhiều mạng xã hội. Mọi endpoint nằm dưới <C>{base}/api/v1</C> và trả về JSON.</p>
        </header>

        <H2 id="tong-quan">Tổng quan</H2>
        <p>Có hai khái niệm:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>API remote</b>: một endpoint có API key riêng, ví dụ mỗi khách hàng hoặc thương hiệu một API remote. Tạo ở trang <Link href="/dashboard" className="underline">Bảng điều khiển</Link>.</li>
          <li><b>API con</b>: một tài khoản mạng xã hội nối vào API remote, kèm token bạn dán vào. Mỗi API con có một <b>label</b> duy nhất (vd <C>tiktok-shop-a</C>) để chọn khi gọi API.</li>
        </ul>
        <p>Khi bạn gọi <C>POST /api/v1/post</C>, hệ thống gửi bài song song tới các API con được chọn và trả về kết quả của từng cái.</p>

        <H2 id="xac-thuc">Xác thực</H2>
        <p>Gửi API key của API remote trong header <C>Authorization</C>. Chấp nhận cả tiền tố <C>Apikey</C> lẫn <C>Bearer</C>:</p>
        <Pre>{`Authorization: Apikey aio_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Pre>
        <ul className="list-disc space-y-1 pl-5">
          <li>Key chỉ hiện một lần khi tạo hoặc cấp lại. Hệ thống chỉ lưu bản băm SHA-256, nên không xem lại được. Mất key thì bấm <b>Cấp lại key</b>; key cũ ngừng hoạt động ngay.</li>
          <li>API remote đang <b>tạm dừng</b> sẽ từ chối mọi request với mã <C>401</C>.</li>
          <li>Chỉ gọi API từ server/backend của bạn. Không nhúng key vào code chạy trên trình duyệt hay app di động.</li>
        </ul>

        <H2 id="dang-bai">POST /api/v1/post — Đăng bài</H2>
        <p>Body JSON (<C>Content-Type: application/json</C>). Cần ít nhất một trong <C>text</C>, <C>link</C> hoặc <C>media</C>.</p>
        <Table
          head={["Trường", "Kiểu", "Mô tả"]}
          rows={[
            [<C key="a">text</C>, "string", <>Nội dung / caption. Tên khác được chấp nhận: <C>caption</C>. Tự cắt theo giới hạn của từng nền tảng (X 280, Bluesky 300, Threads 500…).</>],
            [<C key="a">title</C>, "string", "Tiêu đề, dùng cho YouTube (tối đa 100 ký tự). Nếu bỏ trống, YouTube lấy từ text."],
            [<C key="a">link</C>, "string", "URL đính kèm, được nối vào cuối caption. Facebook dùng làm link preview khi bài không có media."],
            [<C key="a">media</C>, "array", <>Danh sách URL công khai. Mỗi phần tử là chuỗi URL hoặc <C>{`{ "url": "...", "type": "image" | "video" }`}</C>. Bỏ <C>type</C> thì đuôi <C>.mp4 .mov .m4v .webm .avi .mkv</C> được hiểu là video, còn lại là ảnh. Tên khác: <C>image_url</C>, <C>video_url</C>.</>],
            [<C key="a">platforms</C>, "string[]", <>API con sẽ nhận bài — xem <a href="#chon-api-con" className="underline">Chọn API con</a>. Bỏ trống hoặc <C>["all"]</C> = mọi API con đang bật. Tên khác: <C>platform</C>, <C>platform[]</C>.</>],
            [<C key="a">options</C>, "object", <>Tuỳ chọn riêng theo nền tảng hoặc theo label — xem <a href="#options" className="underline">Tuỳ chọn</a>.</>],
            [<C key="a">scheduled_at</C>, "string", <>Thời điểm đăng, ISO 8601 có múi giờ, vd <C>2026-10-10T09:00:00+07:00</C>. Thời điểm cách hiện tại dưới 30 giây sẽ đăng ngay.</>],
            [<C key="a">async</C>, "boolean", <>Mặc định <C>false</C>: chờ đăng xong mới trả kết quả (có thể mất vài phút với video). <C>true</C>: trả <C>202</C> ngay, xem kết quả bằng <C>GET /api/v1/posts/:id</C>.</>],
          ]}
        />
        <CodeTabs tabs={[
          { id: "curl", label: "cURL", code: examples.curl },
          { id: "js", label: "JavaScript", code: examples.js },
          { id: "python", label: "Python", code: examples.python },
          { id: "multipart", label: "Upload file", code: examples.multipart },
        ]} />
        <p className="text-[14px] text-muted">
          <b className="text-ink">Upload file trực tiếp</b> (tab Upload file): gửi <C>multipart/form-data</C>, trường file tên <C>video</C>, <C>image</C> hoặc <C>media</C>. File được lưu vào kho Supabase của bạn rồi chuyển URL công khai cho các nền tảng. Trường <C>options</C> gửi dạng chuỗi JSON.
        </p>

        <H2 id="chon-api-con">Chọn API con</H2>
        <p>Mỗi phần tử trong <C>platforms</C> có thể là:</p>
        <Table
          head={["Giá trị", "Ý nghĩa", "Ví dụ"]}
          rows={[
            ["Tên nền tảng", "Mọi API con đang bật của nền tảng đó", <C key="a">tiktok</C>],
            ["Label", "Đúng một API con", <C key="a">tiktok-shop-a</C>],
            ["ID", "Đúng một API con (UUID)", <C key="a">3f2c…</C>],
            [<C key="a">all</C>, "Mọi API con đang bật", <C key="a">[&quot;all&quot;]</C>],
          ]}
        />
        <p>Có thể trộn các loại, vd <C>[&quot;youtube&quot;, &quot;tiktok-shop-a&quot;]</C>. API con đang <b>tắt</b> luôn bị bỏ qua. Giá trị không khớp API con nào được trả lại trong <C>unknown_targets</C>; nếu không khớp được API con nào, request bị từ chối với <C>422</C>. Tên nền tảng hợp lệ: {PLATFORMS.map((p, i) => <span key={p.id}>{i ? ", " : ""}<C>{p.id}</C></span>)}.</p>

        <H2 id="options">Tuỳ chọn theo nền tảng</H2>
        <p>Đặt trong <C>options</C>, khoá là tên nền tảng hoặc label. Tuỳ chọn theo label ghi đè tuỳ chọn theo nền tảng.</p>
        <Pre>{`"options": {
  "youtube": { "privacy": "unlisted", "tags": ["review", "2026"] },
  "tiktok-shop-a": { "privacy_level": "SELF_ONLY" },
  "instagram": { "story": true }
}`}</Pre>
        <Table
          head={["Nền tảng", "Khoá", "Giá trị"]}
          rows={[
            [<b key="a">youtube</b>, <C key="b">privacy</C>, <><C>public</C> (mặc định) · <C>unlisted</C> · <C>private</C></>],
            ["", <C key="b">tags</C>, "Mảng chuỗi"],
            ["", <C key="b">category_id</C>, <>ID danh mục YouTube, mặc định <C>22</C> (People &amp; Blogs)</>],
            [<b key="a">tiktok</b>, <C key="b">privacy_level</C>, <><C>PUBLIC_TO_EVERYONE</C> (mặc định) · <C>MUTUAL_FOLLOW_FRIENDS</C> · <C>FOLLOWER_OF_CREATOR</C> · <C>SELF_ONLY</C>. Nếu tài khoản không cho phép mức đã chọn, hệ thống tự hạ xuống <C>SELF_ONLY</C>.</>],
            [<b key="a">instagram</b>, <C key="b">story</C>, <><C>true</C> để đăng Story thay vì bài/Reels (1 media)</>],
          ]}
        />

        <H2 id="phan-hoi">Phản hồi</H2>
        <p>Đăng ngay (mặc định) — <C>200</C>. <C>success</C> là <C>true</C> khi có ít nhất một API con thành công.</p>
        <Pre>{`{
  "success": true,
  "post_id": "8c1d…",
  "status": "partial",
  "results": [
    { "connection_id": "…", "label": "tiktok-shop-a", "platform": "tiktok",
      "ok": true, "id": "7421…", "ms": 8123 },
    { "connection_id": "…", "label": "youtube-kenh-chinh", "platform": "youtube",
      "ok": false, "error": "HTTP 403: …", "ms": 950 }
  ],
  "unknown_targets": []
}`}</Pre>
        <Table
          head={["status", "Ý nghĩa"]}
          rows={[
            [<C key="a">success</C>, "Mọi API con đều đăng thành công"],
            [<C key="a">partial</C>, "Một phần thành công — xem error của từng phần tử trong results"],
            [<C key="a">failed</C>, "Không API con nào thành công"],
            [<C key="a">scheduled</C>, "Đã hẹn giờ, chưa đăng"],
            [<C key="a">processing</C>, "Đang đăng (chế độ async hoặc bài hẹn giờ đang chạy)"],
            [<C key="a">cancelled</C>, "Bài hẹn giờ đã bị huỷ"],
          ]}
        />
        <p>Hẹn giờ hoặc <C>async: true</C> — <C>202</C>:</p>
        <Pre>{`{ "success": true, "post_id": "8c1d…", "status": "scheduled",
  "scheduled_at": "2026-10-10T02:00:00.000Z",
  "targets": [{ "label": "tiktok-shop-a", "platform": "tiktok" }] }`}</Pre>

        <H2 id="lich-su">Lịch sử & hẹn giờ</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Mọi lần gọi (cả từ API lẫn khung Đăng thử) đều được lưu, xem ở mục Lịch sử của từng API remote hoặc qua <C>GET /api/v1/posts</C>.</li>
          <li>Bài hẹn giờ được đăng khi tác vụ định kỳ <C>/api/cron/scheduled</C> chạy. Trên gói Vercel Hobby tác vụ này chạy <b>1 lần/ngày</b>. Muốn đăng đúng giờ, dùng dịch vụ cron ngoài (vd cron-job.org) gọi mỗi 5 phút:<br /><C>{`GET ${base}/api/cron/scheduled`}</C> kèm header <C>Authorization: Bearer CRON_SECRET</C>.</li>
          <li>Huỷ bài hẹn giờ bằng <C>DELETE /api/v1/posts/:id</C> hoặc nút Huỷ trong Lịch sử.</li>
        </ul>

        <H2 id="endpoint-khac">Endpoint khác</H2>
        <Table
          head={["Endpoint", "Mô tả"]}
          rows={[
            [<C key="a">GET /api/v1/me</C>, <>Kiểm tra key. Trả <C>{`{ success, remote_api: { id, name } }`}</C></>],
            [<C key="a">GET /api/v1/connections</C>, <>Danh sách API con: <C>id, platform, label, display_name, enabled, status, last_error</C>. Không bao giờ trả token.</>],
            [<C key="a">GET /api/v1/posts</C>, <>Lịch sử, mới nhất trước. Query: <C>limit</C> (mặc định 20, tối đa 100), <C>status</C>.</>],
            [<C key="a">GET /api/v1/posts/:id</C>, "Chi tiết một bài: payload, trạng thái, kết quả từng API con"],
            [<C key="a">DELETE /api/v1/posts/:id</C>, <>Huỷ bài đang <C>scheduled</C>. Bài ở trạng thái khác trả <C>409</C>.</>],
          ]}
        />
        <Pre>{`curl ${base}/api/v1/posts?status=scheduled -H "Authorization: Apikey aio_xxxxxxxx"`}</Pre>

        <H2 id="ma-loi">Mã lỗi</H2>
        <p>Lỗi của cả request có dạng <C>{`{ "success": false, "error": "…" }`}</C>. Lỗi của riêng một API con nằm trong <C>results[].error</C> và không làm hỏng các API con khác.</p>
        <Table
          head={["HTTP", "Khi nào", "Cách xử lý"]}
          rows={[
            [<C key="a">400</C>, "Body không phải JSON, thiếu nội dung, scheduled_at sai định dạng", "Sửa body theo bảng tham số"],
            [<C key="a">401</C>, "Thiếu/sai API key, hoặc API remote đang tạm dừng", "Kiểm tra header Authorization; bật lại API remote"],
            [<C key="a">404</C>, "Post không tồn tại hoặc thuộc API remote khác", "Kiểm tra post_id"],
            [<C key="a">409</C>, "Huỷ bài không ở trạng thái scheduled", "Chỉ huỷ được bài chưa đăng"],
            [<C key="a">422</C>, <>Không có API con nào khớp/đang bật. Phản hồi kèm <C>unknown_targets</C> và <C>available</C></>, "Dùng một label/nền tảng trong available"],
            [<C key="a">500</C>, "Lỗi hệ thống", "Thử lại sau; xem lịch sử để tránh đăng trùng"],
          ]}
        />
        <p className="text-[14px] text-muted">API con lỗi sẽ chuyển đèn đỏ trong bảng điều khiển, kèm thông báo lỗi gần nhất. Thường gặp nhất là token hết hạn: lấy token mới, gỡ API con cũ rồi nối lại.</p>

        <H2 id="gioi-han">Nền tảng hỗ trợ</H2>
        <Table
          head={["Nền tảng", "Chỉ text", "Ảnh", "Nhiều ảnh", "Video", "Ghi chú"]}
          rows={PLATFORMS.map((p) => [
            <span key="n" className="flex items-center gap-2 font-medium"><span className="h-3.5 w-1 rounded-full" style={{ background: p.color }} />{p.name}<C>{p.id}</C></span>,
            p.supports.text ? "✓" : "—",
            p.supports.image ? "✓" : "—",
            p.supports.multiImage ? "✓" : "—",
            p.supports.video ? "✓" : "—",
            <span key="g" className="text-[13px] text-muted">{p.note || ""}</span>,
          ])}
        />

        <H2 id="lay-token">Lấy token cho API con</H2>
        <p>Mọi API con đều kết nối bằng key/token bạn tự lấy từ nền tảng. Token được kiểm tra trước khi lưu và mã hoá AES-256-GCM. Bấm từng nền tảng để xem hướng dẫn.</p>
        <div className="space-y-2">
          {PLATFORMS.map((p) => {
            const g = GUIDES[p.id];
            if (!g) return null;
            return (
              <details key={p.id} id={`token-${p.id}`} className="panel scroll-mt-6 px-4 py-3 open:pb-4">
                <summary className="flex cursor-pointer select-none items-center gap-2 font-semibold">
                  <span className="h-4 w-1.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                  <span className="ml-auto text-[13px] font-normal text-muted">{(p.fields || []).filter((f) => !f.optional).map((f) => f.label).join(", ")}</span>
                </summary>
                <div className="mt-3">
                  <PlatformGuideView guide={g} appUrl={base} />
                </div>
              </details>
            );
          })}
        </div>
      </article>
    </div>
  );
}
