import { useDeferredValue, useEffect, useRef } from "react";

const KEYWORDS = [
  "pub",
  "fn",
  "struct",
  "impl",
  "use",
  "let",
  "const",
  "async",
  "await",
  "return",
  "Result",
  "Context",
  "export",
  "interface",
  "type",
  "match",
  "mut",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightLine(line: string): string {
  let output = escapeHtml(line);

  output = output.replace(
    /(\/\/.*)$/g,
    '<span class="text-slate-500">$1</span>'
  );
  output = output.replace(
    /("(?:[^"\\]|\\.)*")/g,
    '<span class="text-amber-200">$1</span>'
  );
  output = output.replace(
    /\b(\d+)\b/g,
    '<span class="text-cyan-200">$1</span>'
  );

  for (const keyword of KEYWORDS) {
    output = output.replace(
      new RegExp(`\\b(${keyword})\\b`, "g"),
      '<span class="text-fuchsia-300">$1</span>'
    );
  }

  return output;
}

interface CodePanelProps {
  code: string;
}

export function CodePanel({ code }: CodePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const deferredCode = useDeferredValue(code);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [deferredCode]);

  const lines = deferredCode ? deferredCode.split("\n") : [];

  return (
    <section className="arena-panel arena-outline code-gradient rounded-[28px] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-title">Code Stream</div>
          <h2 className="mt-2 font-display text-2xl text-white">
            Live Anchor Build
          </h2>
        </div>
        <div className="rounded-full border border-amber-200/15 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-100/70">
          character stream
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 h-[460px] overflow-auto rounded-[24px] border border-white/10 bg-[#02060d]/90 p-4 sm:p-5"
      >
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-slate-500">
            El c&#243;digo Anchor aparecer&#225; aqu&#237; en tiempo real cuando el
            Coder empiece a trabajar.
          </div>
        ) : (
          <div className="font-mono text-[13px] leading-6 text-slate-200">
            {lines.map((line, index) => (
              <div key={`${index}-${line}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                <span className="select-none text-right text-slate-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: highlightLine(line) || " " }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
