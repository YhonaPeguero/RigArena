import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import type { AgentRole } from "../types/arena";

const ROLE_META: Record<
  AgentRole,
  { label: string; color: string; softColor: string }
> = {
  tutor: {
    label: "Tutor",
    color: "var(--accent-purple)",
    softColor: "rgba(153, 69, 255, 0.14)",
  },
  coder: {
    label: "Coder",
    color: "var(--accent-cyan)",
    softColor: "rgba(0, 194, 255, 0.14)",
  },
  tester: {
    label: "Tester",
    color: "var(--accent-green)",
    softColor: "rgba(20, 241, 149, 0.14)",
  },
  deployer: {
    label: "Deployer",
    color: "var(--accent-gold)",
    softColor: "rgba(255, 184, 0, 0.14)",
  },
};

const TOKEN_PATTERN = /(\/\/.*$|"(?:[^"\\]|\\.)*"|\b(?:pub|fn|use|let)\b|\b(?:String|u64|bool|Result)\b|[{}()\[\];,:<>])/g;

interface TokenPart {
  text: string;
  tone: "plain" | "keyword" | "type" | "string" | "symbol";
}

function classifyToken(token: string): TokenPart["tone"] {
  if (token.startsWith("//") || token.startsWith('"')) {
    return "string";
  }

  if (["pub", "fn", "use", "let"].includes(token)) {
    return "keyword";
  }

  if (["String", "u64", "bool", "Result"].includes(token)) {
    return "type";
  }

  return "symbol";
}

function tokenizeLine(line: string): TokenPart[] {
  const parts: TokenPart[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    const token = match[0];

    if (index > lastIndex) {
      parts.push({
        text: line.slice(lastIndex, index),
        tone: "plain",
      });
    }

    parts.push({
      text: token,
      tone: classifyToken(token),
    });

    lastIndex = index + token.length;
  }

  if (lastIndex < line.length) {
    parts.push({
      text: line.slice(lastIndex),
      tone: "plain",
    });
  }

  if (parts.length === 0) {
    parts.push({ text: " ", tone: "plain" });
  }

  return parts;
}

function toneClassName(tone: TokenPart["tone"]): string {
  switch (tone) {
    case "keyword":
      return "text-[var(--accent-purple)]";
    case "type":
      return "text-[var(--accent-cyan)]";
    case "string":
      return "text-[rgba(20,241,149,0.7)]";
    case "symbol":
      return "text-[var(--text-secondary)]";
    default:
      return "text-[var(--text-primary)]";
  }
}

interface LiveStreamProps {
  code: string;
  activeAgent: AgentRole | null;
  progress: number;
  visible: boolean;
}

export function LiveStream({
  code,
  activeAgent,
  progress,
  visible,
}: LiveStreamProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => (code ? code.split("\n") : []), [code]);
  const tokenizedLines = useMemo(() => lines.map((line) => tokenizeLine(line)), [lines]);
  const meta = activeAgent ? ROLE_META[activeAgent] : null;

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [code]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.section
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.4 }}
          className="panel-shell overflow-hidden px-4 py-4 sm:px-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="inline-flex w-fit rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em]"
              style={{
                backgroundColor: meta?.softColor ?? "rgba(255,255,255,0.04)",
                color: meta?.color ?? "var(--text-secondary)",
              }}
            >
              AGENTE ACTIVO: {meta?.label ?? "Idle"}
            </div>

            <div className="flex-1 px-0 lg:px-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-purple),var(--accent-cyan),var(--accent-green),var(--accent-gold))]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.45 }}
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-green)]">
              <span style={{ animation: "live-blink 1.2s ease-in-out infinite" }}>●</span>
              LIVE
            </div>
          </div>

          <div
            ref={scrollRef}
            className="mt-4 h-[280px] overflow-y-auto rounded-[14px] border border-white/6 bg-[#0d0d1a] px-4 py-4"
          >
            <div className="font-code text-[13px] leading-6 text-[var(--text-primary)]">
              {tokenizedLines.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">
                  Esperando el primer bloque de código del agente.
                </div>
              ) : (
                tokenizedLines.map((line, index) => {
                  const isLast = index === tokenizedLines.length - 1;

                  return (
                    <div
                      key={`${index}-${lines[index]}`}
                      className="grid grid-cols-[42px_minmax(0,1fr)] gap-3"
                    >
                      <span className="text-right text-[var(--text-muted)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="relative whitespace-pre-wrap break-words">
                        {line.map((part, partIndex) => (
                          <span
                            key={`${index}-${partIndex}-${part.text}`}
                            className={toneClassName(part.tone)}
                          >
                            {part.text}
                          </span>
                        ))}
                        {isLast ? (
                          <span
                            className="ml-1 inline-block h-4 w-[2px] bg-[var(--accent-cyan)] align-middle"
                            style={{ animation: "cursor-blink 1s step-end infinite" }}
                          />
                        ) : null}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
