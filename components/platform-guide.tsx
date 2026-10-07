import { CopyButton } from "@/components/copy";
import { fillAppUrl, type PlatformGuide } from "@/lib/platforms/guides";

/** Biến URL trong văn bản thành link; URL chứa chỗ cần thay (<…>, CLIENT_KEY…) hiển thị dạng code */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s"]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
        const clean = p.replace(/[.,)]+$/, "");
        const tail = p.slice(clean.length);
        const templated = /[<>]|CLIENT_|APP_SECRET|TOKEN_|CODE\b/.test(clean);
        return (
          <span key={i}>
            {templated ? (
              <code className="break-all rounded bg-[#e1e6ee] px-1 font-mono text-[12px]">{clean}</code>
            ) : (
              <a href={clean} target="_blank" rel="noreferrer" className="break-all underline decoration-line underline-offset-2 hover:decoration-ink">
                {clean}
              </a>
            )}
            {tail}
          </span>
        );
      })}
    </>
  );
}

export function PlatformGuideView({ guide, appUrl, compact = false }: { guide: PlatformGuide; appUrl: string; compact?: boolean }) {
  const f = (s: string) => fillAppUrl(s, appUrl);
  return (
    <div className={compact ? "space-y-3 text-[13px] leading-relaxed" : "space-y-4 text-[14.5px] leading-relaxed"}>
      <p className="text-muted">{guide.summary}</p>
      <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-muted">
        {guide.steps.map((s, i) => (
          <li key={i} className="pl-1 [overflow-wrap:anywhere]">
            <Rich text={f(typeof s === "string" ? s : s.text)} />
            {typeof s !== "string" && (
              <div className="mt-1.5">
                <pre className="code !mt-0 whitespace-pre-wrap break-all !px-3 !py-2.5 !text-[12px]">{f(s.code)}</pre>
                <div className="mt-1 flex justify-end">
                  <CopyButton text={f(s.code)} className="text-[12px] font-semibold underline" label="Sao chép" />
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {guide.caveats && guide.caveats.length > 0 && (
        <div className="rounded-md border border-[#f3d9a0] bg-[#fff8e5] px-3 py-2">
          <p className="font-semibold text-signal-ink">Lưu ý</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {guide.caveats.map((c, i) => (
              <li key={i}>{f(c)}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="font-semibold">Tài liệu chính thức</p>
        <ul className="mt-1 space-y-1">
          {guide.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
