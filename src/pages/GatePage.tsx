import { motion } from "framer-motion";

interface GatePageProps {
  connecting: boolean;
  walletAvailable: boolean;
  onConnect: () => void;
}

const STAGGER = {
  initial: { opacity: 0, y: 24 },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: index * 0.15 },
  }),
};

export function GatePage({ connecting, walletAvailable, onConnect }: GatePageProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-base)] px-6 py-12">
      <div className="tron-grid" />

      <section className="panel-shell relative z-10 w-full max-w-[420px] px-8 py-10 text-center">
        <motion.div custom={0} initial="initial" animate="animate" variants={STAGGER}>
          <h1 className="font-display text-[48px] font-bold tracking-[-0.06em] text-gradient-brand">
            RIGARENA
          </h1>
        </motion.div>

        <motion.p
          custom={1}
          initial="initial"
          animate="animate"
          variants={STAGGER}
          className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]"
        >
          Solana LATAM Hackathon 2026
        </motion.p>

        <motion.p
          custom={2}
          initial="initial"
          animate="animate"
          variants={STAGGER}
          className="mx-auto mt-6 max-w-[320px] text-sm leading-7 text-[var(--text-secondary)]"
        >
          Conecta tu wallet para acceder a la arena.
          <br />
          4 agentes. 1 prompt. 1 Proof-of-Build.
        </motion.p>

        <motion.div
          custom={3}
          initial="initial"
          animate="animate"
          variants={STAGGER}
          className="mt-8"
        >
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="w-full rounded-[14px] border border-white/10 bg-[linear-gradient(135deg,var(--accent-purple),var(--accent-cyan))] px-5 py-4 font-display text-base font-bold text-white transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting
              ? "Conectando..."
              : walletAvailable
                ? "WalletMultiButton"
                : "Instalar / Conectar Wallet"}
          </button>
        </motion.div>

        <motion.p
          custom={4}
          initial="initial"
          animate="animate"
          variants={STAGGER}
          className="mt-5 text-xs text-[var(--text-muted)]"
        >
          Devnet · Sin costo real · Solo USDC de prueba
        </motion.p>
      </section>
    </main>
  );
}
