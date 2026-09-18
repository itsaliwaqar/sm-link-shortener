import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";

export default function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-900">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          {copied ? (
            <>
              <IconCheck className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <IconCopy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100">
        <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{code}</code>
      </pre>
    </div>
  );
}
