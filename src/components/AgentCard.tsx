import { motion } from "framer-motion";
import type { AgentRole, AgentStatus, PaymentEvent } from "../types/arena";

const ROLE_META: Record<
  AgentRole,
  {
    icon: string;
    title: string;
    subtitle: string;
  }
> = {
  tutor: {
    icon: "[?]",
    title: "Tutor",
    subtitle: "Descompone el prompt en subtareas ejecutables.",
  },
  coder: {
    icon: "</>",
    title: "Coder",
    subtitle: "Convierte el plan en Anchor + Rust comentado.",
  },
  tester: {
    icon: "[ok]",
    title: "Tester",
    subtitle: "Valida errores, cobertura y estado del build.",
  },
  deployer: {
    icon: "[=>]",
    title: "Deployer",
    subtitle: "Simula build, deploy y dispara el Proof NFT.",
  },
};

const STATUS_META: Record<
  AgentStatus,
  {
    badge: string;
    tone: string;
  }
> = {
  idle: {
    badge: "Idle",
    tone: "border-white/10 bg-white/[0.03] text-slate-300",
  },
  active: {
    badge: "Active",
    tone: "border-amber-300/40 bg-amber-400/10 text-amber-100",
  },
  complete: {
    badge: "Complete",
    tone: "border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
  },
  error: {
    badge: "Error",
    tone: "border-red-300/35 bg-red-500/10 text-red-100",
  },
};

function truncateTx(tx: string): string {
  if (tx.length <= 14) {
    return tx;
  }

  return `${tx.slice(0, 6)}...${tx.slice(-6)}`;
}

interface AgentCardProps {
  role: AgentRole;
  status: AgentStatus;
  lastPayment?: PaymentEvent;
}

export function AgentCard({ role, status, lastPayment }: AgentCardProps) {
  const meta = ROLE_META[role];
  const statusMeta = STATUS_META[status];

  return (
    <motion.article
      animate={
        status === "active"
          ? {
              boxShadow: [
                "0 0 0 rgba(247,201,72,0.0)",
                "0 0 38px rgba(247,201,72,0.18)",
                "0 0 0 rgba(247,201,72,0.0)",
              ],
            }
          : { boxShadow: "0 0 0 rgba(0,0,0,0)" }
      }
      transition={{
        duration: 1.8,
        repeat: status === "active" ? Infinity : 0,
        ease: "easeInOut",
      }}
      className="arena-panel arena-outline rounded-[24px] p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 font-display text-sm tracking-[0.18em] text-cyan-100/85">
            {meta.icon}
          </div>
          <div>
            <div className="font-display text-xl text-white">{meta.title}</div>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${statusMeta.tone}`}
        >
          {statusMeta.badge}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Last inflow
          </span>
          <span className="text-sm font-semibold text-[var(--arena-gold)]">
            {lastPayment ? `${lastPayment.amount.toFixed(3)} USDC` : "--"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Tx Hash
          </span>
          <span className="font-mono text-xs text-cyan-100/80">
            {lastPayment ? truncateTx(lastPayment.tx) : "awaiting"}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
