import { AnimatePresence, motion } from "framer-motion";
import type { MintEvent } from "../types/arena";

function truncate(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function buildBlinkUrl(mint: string): string {
  return `https://dial.to/?action=solana-action:https://rigarena.dev/api/blink/${mint}`;
}

function buildExplorerUrl(mint: string): string {
  return `https://explorer.solana.com/address/${mint}?cluster=devnet`;
}

interface ProofNFTProps {
  nft: MintEvent["nft"] | null;
  prompt: string;
}

export function ProofNFT({ nft, prompt }: ProofNFTProps) {
  const fallbackName = `Proof of Build -- ${prompt.slice(0, 28) || "RigArena Session"}`;

  return (
    <AnimatePresence>
      {nft ? (
        <motion.section
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="arena-outline rounded-[30px] border border-violet-300/25 bg-[linear-gradient(145deg,rgba(18,6,37,0.92),rgba(10,16,28,0.92))] p-5 shadow-[0_25px_90px_rgba(139,92,246,0.18)]"
        >
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center">
            <div className="overflow-hidden rounded-[24px] border border-violet-200/20 bg-white/[0.03] p-3">
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#12071f]">
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="aspect-square h-full w-full object-cover"
                />
              </div>
            </div>

            <div>
              <div className="section-title text-violet-200/70">Proof NFT</div>
              <h2 className="mt-2 font-display text-3xl text-white">
                {nft.name || fallbackName}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100/75">
                {nft.description}
              </p>

              <div className="mt-5 grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-violet-100/45">
                    Mint Address
                  </div>
                  <a
                    href={buildExplorerUrl(nft.mint)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex font-mono text-sm text-cyan-100 transition hover:text-white"
                  >
                    {truncate(nft.mint)}
                  </a>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-violet-100/45">
                    Status
                  </div>
                  <div className="mt-2 font-display text-lg text-violet-100">
                    Soulbound ready
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <a
                  href={buildBlinkUrl(nft.mint)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-[18px] border border-violet-300/30 bg-violet-400/10 px-4 py-3 text-sm font-semibold text-violet-50 transition hover:-translate-y-0.5 hover:bg-violet-400/15"
                >
                  Probar en devnet
                </a>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
