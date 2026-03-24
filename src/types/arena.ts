// ── Arena agent types ──────────────────────────────────────────────────────
export type AgentRole = "tutor" | "coder" | "tester" | "deployer";

export type AgentStatus = "idle" | "active" | "complete" | "error";

// ── Arena events ───────────────────────────────────────────────────────────
export interface PaymentEvent {
  type: "payment";
  from: AgentRole;
  to: AgentRole;
  amount: number; // en USDC
  tx: string; // tx hash real o mock realista
  timestamp: number;
}

export interface AgentEvent {
  type: "agent_start" | "agent_complete" | "agent_stream";
  agent: AgentRole;
  content: string;
}

export interface MintEvent {
  type: "mint";
  nft: {
    name: string;
    description: string;
    mint: string; // mint address
    image: string; // generado proceduralmente
  };
}

export type ArenaEvent = PaymentEvent | AgentEvent | MintEvent;

// ── Arena state ────────────────────────────────────────────────────────────
export interface ArenaState {
  status: "idle" | "running" | "complete";
  prompt: string;
  agents: Record<AgentRole, AgentStatus>;
  payments: PaymentEvent[];
  code: string;
  nft: MintEvent["nft"] | null;
  totalPaid: number;
}
