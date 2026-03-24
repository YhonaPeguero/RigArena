import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { AgentRole, AgentStatus, ArenaState, PaymentEvent } from "../types/arena";

const ROLE_META: Record<
  AgentRole,
  {
    color: string;
    softColor: string;
    icon: string;
    name: string;
    description: string;
  }
> = {
  tutor: {
    color: "var(--accent-purple)",
    softColor: "rgba(153, 69, 255, 0.15)",
    icon: "[?]",
    name: "Tutor",
    description: "Descompone el prompt en subtareas accionables.",
  },
  coder: {
    color: "var(--accent-cyan)",
    softColor: "rgba(0, 194, 255, 0.15)",
    icon: "</>",
    name: "Coder",
    description: "Convierte la idea en flujo Anchor y Rust.",
  },
  tester: {
    color: "var(--accent-green)",
    softColor: "rgba(20, 241, 149, 0.15)",
    icon: "[ok]",
    name: "Tester",
    description: "Valida fallos, edge cases y estado del build.",
  },
  deployer: {
    color: "var(--accent-gold)",
    softColor: "rgba(255, 184, 0, 0.15)",
    icon: "[=>]",
    name: "Deployer",
    description: "Cierra el flujo y dispara el Proof NFT.",
  },
};

const ROLE_ORDER: AgentRole[] = ["tutor", "coder", "tester", "deployer"];

interface PipelinePanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  state: ArenaState;
  activeAgent: AgentRole | null;
  completedCount: number;
  onStart: () => void;
  isRunning: boolean;
}

function findLatestInboundPayment(
  payments: PaymentEvent[],
  role: AgentRole
): PaymentEvent | undefined {
  return [...payments].reverse().find((payment) => payment.to === role);
}

function truncateTx(tx?: string): string {
  if (!tx) {
    return "...";
  }

  return `${tx.slice(0, 4)}...${tx.slice(-4)}`;
}

function statusLabel(status: AgentStatus): string {
  switch (status) {
    case "idle":
      return "waiting";
    case "active":
      return "active";
    case "complete":
      return "complete";
    case "error":
      return "error";
    default:
      return "waiting";
  }
}

function renderStatusTone(role: AgentRole, status: AgentStatus) {
  const accent = ROLE_META[role].color;

  if (status === "active") {
    return {
      borderLeft: `3px solid ${accent}`,
      background: "rgba(22, 22, 40, 0.95)",
      color: "var(--text-primary)",
    };
  }

  if (status === "complete") {
    return {
      borderLeft: "3px solid rgba(20, 241, 149, 0.5)",
      background: "rgba(15, 15, 30, 0.88)",
      color: "var(--text-primary)",
    };
  }

  if (status === "error") {
    return {
      borderLeft: "3px solid rgba(255, 120, 120, 0.7)",
      background: "rgba(32, 12, 20, 0.9)",
      color: "var(--text-primary)",
    };
  }

  return {
    borderLeft: "3px solid transparent",
    background: "rgba(15, 15, 30, 0.88)",
    color: "var(--text-muted)",
  };
}

export function PipelinePanel({
  prompt,
  onPromptChange,
  state,
  activeAgent,
  completedCount,
  onStart,
  isRunning,
}: PipelinePanelProps) {
  return (
    <aside className="panel-shell relative flex h-full flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
      <div className="section-kicker">Tu Prompt</div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={3}
        placeholder="Describe qué quieres aprender de Solana..."
        className="min-h-[92px] resize-none rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none transition focus:border-[var(--border-active)] focus:shadow-[0_0_0_4px_rgba(153,69,255,0.12)]"
      />

      <button
        type="button"
        onClick={onStart}
        disabled={isRunning || !prompt.trim()}
        className={`relative w-full rounded-[14px] px-4 py-4 font-display text-base font-bold text-white transition ${
          isRunning || !prompt.trim()
            ? "cursor-not-allowed bg-[linear-gradient(135deg,var(--accent-purple),var(--accent-cyan))] opacity-40"
            : "bg-[linear-gradient(135deg,var(--accent-purple),var(--accent-cyan))] hover:scale-[1.02] hover:brightness-110"
        } ${isRunning ? "shimmer" : ""}`}
      >
        {isRunning ? "Procesando..." : "⚡ Iniciar Arena"}
      </button>

      <div className="grid grid-cols-3 overflow-hidden rounded-[14px] border border-white/6 bg-[var(--bg-elevated)] text-center text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        <div className="px-3 py-3">
          Estado: <span className="text-[var(--text-primary)]">{state.status}</span>
        </div>
        <div className="border-x border-white/6 px-3 py-3">
          Pagado:{" "}
          <AnimatePresence mode="popLayout">
            <motion.span
              key={state.totalPaid}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="inline-block text-[var(--text-primary)]"
            >
              {state.totalPaid.toFixed(3)}
            </motion.span>
          </AnimatePresence>{" "}
          USDC
        </div>
        <div className="px-3 py-3">
          Flujo: <span className="text-[var(--text-primary)]">{completedCount}/4</span>
        </div>
      </div>

      <LayoutGroup>
        <div className="flex flex-1 flex-col gap-3">
          {ROLE_ORDER.map((role) => {
            const meta = ROLE_META[role];
            const status = state.agents[role];
            const payment = findLatestInboundPayment(state.payments, role);
            const tone = renderStatusTone(role, status);
            const statusText = status === "complete" ? "✓" : statusLabel(status);

            return (
              <motion.article
                key={role}
                layout
                transition={{ duration: 0.35 }}
                style={tone}
                className={`relative rounded-[14px] border border-[var(--border-subtle)] px-4 py-4 ${status === "active" ? "shimmer" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-[12px] font-code text-sm"
                      style={{ backgroundColor: meta.softColor }}
                    >
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                    </div>
                    <div>
                      <div
                        className="font-display text-lg font-bold"
                        style={{ color: status === "active" ? meta.color : undefined }}
                      >
                        {meta.name}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {meta.description}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                    {statusText}
                  </div>
                </div>

                <div className="mt-4 h-px bg-white/8" />

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  <span>
                    Last inflow:{" "}
                    <span
                      style={{
                        color:
                          status === "complete"
                            ? "var(--accent-green)"
                            : "var(--text-primary)",
                      }}
                    >
                      {payment ? `${payment.amount.toFixed(3)} USDC` : "--"}
                    </span>
                  </span>
                  <span>
                    TX:{" "}
                    <span
                      className="font-code"
                      style={{
                        color:
                          status === "complete"
                            ? "var(--accent-green)"
                            : activeAgent === role
                              ? meta.color
                              : "var(--text-primary)",
                      }}
                    >
                      {truncateTx(payment?.tx)}
                    </span>
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
      </LayoutGroup>
    </aside>
  );
}
