import { useEffect, useRef } from "react";
import { ArenaScene } from "../three/ArenaScene";
import type { AgentRole, AgentStatus, MintEvent, PaymentEvent } from "../types/arena";

const ROLE_ORDER: AgentRole[] = ["tutor", "coder", "tester", "deployer"];

function findActiveRole(agents: Record<AgentRole, AgentStatus>): AgentRole | null {
  return ROLE_ORDER.find((role) => agents[role] === "active") ?? null;
}

interface ArenaCanvasProps {
  agents: Record<AgentRole, AgentStatus>;
  payments: PaymentEvent[];
  nft: MintEvent["nft"] | null;
  isRunning: boolean;
}

export function ArenaCanvas({
  agents,
  payments,
  nft,
  isRunning,
}: ArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const paymentCursorRef = useRef(0);
  const mintCursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const scene = new ArenaScene();
    scene.init(canvasRef.current);
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const activeRole = findActiveRole(agents);
    if (!activeRole || !sceneRef.current) {
      return;
    }

    sceneRef.current.activateAgent(activeRole);
  }, [agents]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    const newPayments = payments.slice(paymentCursorRef.current);
    for (const payment of newPayments) {
      sceneRef.current.addFlyingCoin(payment.from, payment.to);
    }

    paymentCursorRef.current = payments.length;
  }, [payments]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    if (nft && nft.mint !== mintCursorRef.current) {
      sceneRef.current.mintNFTExplosion();
      mintCursorRef.current = nft.mint;
    }

    if (!nft) {
      mintCursorRef.current = null;
    }
  }, [nft]);

  useEffect(() => {
    if (isRunning || !sceneRef.current) {
      return;
    }

    let step = 0;
    const interval = window.setInterval(() => {
      if (!sceneRef.current) {
        return;
      }

      const role = ROLE_ORDER[step % ROLE_ORDER.length];
      const nextRole = ROLE_ORDER[(step + 1) % ROLE_ORDER.length];
      sceneRef.current.activateAgent(role);
      sceneRef.current.addFlyingCoin(role, nextRole);

      if (step > 0 && step % (ROLE_ORDER.length + 1) === 0) {
        sceneRef.current.mintNFTExplosion();
      }

      step += 1;
    }, 2200);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRunning]);

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.08),transparent_32%),linear-gradient(180deg,rgba(7,12,20,0.98),rgba(5,11,20,0.8))]">
      <canvas
        ref={canvasRef}
        className="block aspect-[16/9] w-full"
        aria-label="RigArena 3D canvas"
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[14%] rounded-full border border-cyan-200/15 bg-slate-950/40 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100/65">
          Tutor
        </div>
        <div className="absolute right-[12%] top-[14%] rounded-full border border-cyan-200/15 bg-slate-950/40 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100/65">
          Coder
        </div>
        <div className="absolute bottom-[16%] left-[18%] rounded-full border border-cyan-200/15 bg-slate-950/40 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100/65">
          Tester
        </div>
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded-full border border-cyan-200/15 bg-slate-950/40 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100/65">
          Deployer
        </div>
      </div>
    </div>
  );
}
