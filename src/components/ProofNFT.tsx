import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { MintEvent } from "../types/arena";

interface ProofNFTProps {
  nft: MintEvent["nft"] | null;
  prompt: string;
}

function truncate(value: string): string {
  return value.length > 12 ? `${value.slice(0, 5)}...${value.slice(-4)}` : value;
}

export function ProofNFT({ nft, prompt }: ProofNFTProps) {
  const [copied, setCopied] = useState(false);

  if (!nft) {
    return null;
  }

  const proof = nft;

  async function shareProof() {
    const url = `https://explorer.solana.com/address/${proof.mint}?cluster=devnet`;

    if (navigator.share) {
      await navigator.share({
        title: proof.name,
        text: `Proof of Build para ${prompt || "RigArena"}`,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, scale: 0.75, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="panel-shell mx-auto flex w-full max-w-[700px] flex-col gap-5 px-5 py-5 md:flex-row md:items-center"
      >
        <div className="relative h-[200px] w-[200px] shrink-0 rounded-[18px] p-[1px]">
          <div
            className="absolute inset-0 rounded-[18px] bg-[conic-gradient(from_0deg,var(--accent-purple),var(--accent-cyan),var(--accent-gold),var(--accent-purple))]"
            style={{ animation: "hue-spin 8s linear infinite" }}
          />
          <div className="absolute inset-[1px] rounded-[17px] bg-[var(--bg-base)]" />
          <motion.div
            whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
            className="absolute inset-[10px] overflow-hidden rounded-[14px]"
            style={{ backgroundImage: `url(${proof.image})`, backgroundSize: "cover" }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="section-kicker">Proof NFT</div>
          <h2 className="mt-2 font-display text-3xl font-bold text-white">
            {proof.name || "Proof of Build"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            {proof.description}
          </p>

          <div className="mt-4 h-px bg-white/8" />

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
            <span>
              MINT: <span className="font-code text-[var(--text-primary)]">{truncate(proof.mint)}</span>
            </span>
            <span>
              STATUS: <span className="text-[var(--accent-green)]">✓</span>
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`https://explorer.solana.com/address/${proof.mint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[12px] border border-white/10 bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold transition hover:border-[var(--border-active)]"
            >
              Probar en Devnet
            </a>
            <button
              type="button"
              onClick={() => void shareProof()}
              className="rounded-[12px] border border-white/10 bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold transition hover:border-[var(--border-active)]"
            >
              {copied ? "Copiado" : "Compartir"}
            </button>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
