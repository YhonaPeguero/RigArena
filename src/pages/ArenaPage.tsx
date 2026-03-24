import { Suspense, lazy, useState } from "react";
import { motion } from "framer-motion";
import { AgentCard } from "../components/AgentCard";
import { CodePanel } from "../components/CodePanel";
import { ProofNFT } from "../components/ProofNFT";
import { useArena } from "../hooks/useArena";
import type { AgentRole, PaymentEvent } from "../types/arena";

const ROLE_ORDER: AgentRole[] = ["tutor", "coder", "tester", "deployer"];
const ArenaCanvas = lazy(async () => ({
  default: (await import("../components/ArenaCanvas")).ArenaCanvas,
}));

function findLatestInboundPayment(
  payments: PaymentEvent[],
  role: AgentRole
): PaymentEvent | undefined {
  return [...payments].reverse().find((payment) => payment.to === role);
}

export function ArenaPage() {
  const [prompt, setPrompt] = useState(
    "Build a Solana Anchor lesson that teaches how PDAs, token flows, and proof NFTs work together."
  );
  const { state, startArena, isRunning } = useArena();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-[var(--arena-copy)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="arena-panel arena-outline rounded-[28px] px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="section-title">Solana LATAM Hackathon 2026</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  RIGARENA
                </h1>
                <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-200">
                  <span className="status-dot bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.95)]" />
                  En Vivo
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-balance text-sm leading-6 text-slate-300 sm:text-base">
                Cuatro agentes especializados convierten un prompt de aprendizaje
                Solana en una arena visual con streaming, pagos entre agentes y
                un Proof-of-Build final.
              </p>
            </div>

            <div className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Estado
                </div>
                <div className="mt-2 font-display text-xl text-white">
                  {state.status}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Pagado
                </div>
                <div className="mt-2 font-display text-xl text-[var(--arena-gold)]">
                  {state.totalPaid.toFixed(3)} USDC
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Flujo
                </div>
                <div className="mt-2 font-display text-xl text-cyan-100">
                  {ROLE_ORDER.filter((role) => state.agents[role] === "complete").length}/4
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="arena-panel arena-outline rounded-[28px] p-3 sm:p-4">
          <Suspense
            fallback={
              <div className="flex aspect-[16/9] items-center justify-center rounded-[24px] border border-white/10 bg-slate-950/60 text-sm uppercase tracking-[0.24em] text-cyan-100/70">
                loading arena
              </div>
            }
          >
            <ArenaCanvas
              agents={state.agents}
              payments={state.payments}
              nft={state.nft}
              isRunning={isRunning}
            />
          </Suspense>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_360px]">
          <CodePanel code={state.code} />

          <div className="grid gap-4">
            {ROLE_ORDER.map((role, index) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                <AgentCard
                  role={role}
                  status={state.agents[role]}
                  lastPayment={findLatestInboundPayment(state.payments, role)}
                />
              </motion.div>
            ))}
          </div>
        </section>

        <section className="arena-panel arena-outline rounded-[28px] p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
            <label className="block">
              <span className="section-title">Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="Describe the Solana learning prompt that the arena should solve."
                className="mt-3 w-full rounded-[22px] border border-white/10 bg-slate-950/70 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <button
              type="button"
              onClick={() => void startArena(prompt)}
              disabled={isRunning || !prompt.trim()}
              className="group relative overflow-hidden rounded-[22px] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(247,201,72,0.24),rgba(255,138,61,0.22),rgba(12,18,32,0.85))] px-5 py-4 text-left text-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(247,201,72,0.18)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
                Arena Trigger
              </div>
              <div className="mt-2 font-display text-2xl font-semibold">
                {isRunning ? "Running..." : "Start Arena"}
              </div>
              <div className="mt-2 text-sm text-amber-50/85">
                Lanza el flujo secuencial Tutor → Coder → Tester → Deployer.
              </div>
            </button>
          </div>
        </section>

        <ProofNFT nft={state.nft} prompt={state.prompt} />
      </div>
    </main>
  );
}
