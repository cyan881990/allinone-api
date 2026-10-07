"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy";

export function ApiSnippet({ appUrl, keyPrefix, labels, platforms }: { appUrl: string; keyPrefix: string; labels: string[]; platforms: string[] }) {
  const [lang, setLang] = useState<"curl" | "js" | "python">("curl");
  const base = appUrl || "https://your-app.vercel.app";
  const key = `${keyPrefix}...`;
  const targets = (platforms.length ? platforms.slice(0, 2) : ["tiktok", "youtube"]).concat(labels[0] && !platforms.includes(labels[0]) ? [labels[0]] : []).slice(0, 3);
  const body = { text: "Nội dung bài đăng", media: [{ url: "https://example.com/video.mp4" }], platforms: targets };

  const code = {
    curl: `curl -X POST ${base}/api/v1/post \\
  -H "Authorization: Apikey ${key}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'

# Upload file trực tiếp (multipart, giống upload-post)
curl -X POST ${base}/api/v1/post \\
  -H "Authorization: Apikey ${key}" \\
  -F "text=Nội dung" -F "video=@clip.mp4" \\
${targets.map((t) => `  -F "platform[]=${t}"`).join(" \\\n")}`,
    js: `const res = await fetch("${base}/api/v1/post", {
  method: "POST",
  headers: {
    Authorization: "Apikey ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}),
});
console.log(await res.json());`,
    python: `import requests

r = requests.post(
    "${base}/api/v1/post",
    headers={"Authorization": "Apikey ${key}"},
    json=${JSON.stringify(body).replace(/"/g, '"')},
)
print(r.json())`,
  }[lang];

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Gọi API</h2>
        <div className="flex rounded-md border border-line p-0.5 text-[13px]" role="tablist">
          {(["curl", "js", "python"] as const).map((l) => (
            <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={`rounded px-2.5 py-1 font-medium ${lang === l ? "bg-ink text-white" : ""}`}>
              {l === "js" ? "JavaScript" : l === "python" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
      </div>
      <pre className="code max-h-[340px]">{code}</pre>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted">Thay <code className="inline">{key}</code> bằng API key đầy đủ.</p>
        <CopyButton text={code} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <dt className="font-mono">GET /api/v1/connections</dt><dd className="text-muted">Danh sách API con</dd>
        <dt className="font-mono">GET /api/v1/posts</dt><dd className="text-muted">Lịch sử, lọc ?status=</dd>
        <dt className="font-mono">GET /api/v1/posts/:id</dt><dd className="text-muted">Kết quả từng API con</dd>
        <dt className="font-mono">DELETE /api/v1/posts/:id</dt><dd className="text-muted">Huỷ bài hẹn giờ</dd>
      </dl>
    </div>
  );
}
