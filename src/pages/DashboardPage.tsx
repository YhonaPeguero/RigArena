import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Arena3D } from "../components/Arena3D";
import { LiveStream } from "../components/LiveStream";
import { PipelinePanel } from "../components/PipelinePanel";
import { ProofNFT } from "../components/ProofNFT";
import { useArena } from "../hooks/useArena";
import type { AgentRole, AgentStatus } from "../types/arena";

const ROLE_ORDER: AgentRole[] = ["tutor", "coder", "tester", "deployer"];

interface DashboardPageProps {
  walletLabel: string;
  onDisconnect: () => void;
}

function getActiveAgent(
  agents: Record<AgentRole, AgentStatus>
): AgentRole | null {
  return ROLE_ORDER.find((role) => agents[role] === "active") ?? null;
}

export function DashboardPage({
  walletLabel,
  onDisconnect,
}: DashboardPageProps) {
  const [prompt, setPrompt] = useState(
    "Quiero entender PDAs, pagos USDC entre agentes y un Proof NFT de devnet."
  );
  const { state, startArena, isRunning } = useArena();
  const activeAgent =
    getActiveAgent(state.agents) ?? (state.status === "complete" ? "deployer" : null);
  const completedCount = ROLE_ORDER.filter(
    (role) => state.agents[role] === "complete"
  ).length;
  const progress = state.status === "complete"
    ? 100
    : activeAgent
      ? ((ROLE_ORDER.indexOf(activeAgent) + 1) / ROLE_ORDER.length) * 100
      : 0;

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-4 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <section className="panel-shell relative min-h-[calc(100vh-2rem)] overflow-hidden px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="tron-grid" />

          <nav className="relative z-10 grid items-center gap-4 border-b border-white/5 pb-5 lg:grid-cols-[1fr_auto_1fr]">
            <div className="font-display text-[28px] font-bold tracking-[-0.05em] text-gradient-brand">
              RIGARENA
            </div>

            <div className="justify-self-center rounded-full border border-white/8 bg-[var(--bg-elevated)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Estado global: {state.status}
            </div>

            <div className="justify-self-end">
              <button
                type="button"
                onClick={onDisconnect}
                className="rounded-full border border-white/10 bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--border-active)] hover:bg-white/5"
              >
                {walletLabel}
              </button>
            </div>
          </nav>

          <div className="relative z-10 mt-5 grid gap-5 md:grid-cols-1 lg:min-h-[calc(100vh-10rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
            <div className="hidden md:block md:h-[300px] lg:h-auto">
              <Arena3D
                agents={state.agents}
                payments={state.payments}
                nft={state.nft}
                isRunning={isRunning}
              />
            </div>

            <PipelinePanel
              prompt={prompt}
              onPromptChange={setPrompt}
              state={state}
              activeAgent={activeAgent}
              completedCount={completedCount}
              onStart={() => void startArena(prompt)}
              isRunning={isRunning}
            />
          </div>
        </section>

        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.section
              key="stream"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45 }}
            >
              <LiveStream
                code={state.code}
                activeAgent={activeAgent}
                progress={progress}
                visible={isRunning}
              />
            </motion.section>
          ) : null}
        </AnimatePresence>

        <ProofNFT nft={state.nft} prompt={state.prompt} />
      </div>
    </main>
  );
}
