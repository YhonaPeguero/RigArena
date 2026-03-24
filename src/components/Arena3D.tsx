import { useEffect, useRef } from "react";
import { ArenaScene } from "../three/ArenaScene";
import type { AgentRole, AgentStatus, MintEvent, PaymentEvent } from "../types/arena";

interface Arena3DProps {
  agents: Record<AgentRole, AgentStatus>;
  payments: PaymentEvent[];
  nft: MintEvent["nft"] | null;
  isRunning: boolean;
}

export function Arena3D({ agents, payments, nft, isRunning }: Arena3DProps) {
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
    sceneRef.current?.syncAgents(agents, isRunning);
  }, [agents, isRunning]);

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

  return (
    <div className="panel-shell h-full min-h-[420px] overflow-hidden lg:min-h-[640px]">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="RigArena 3D" />
    </div>
  );
}
