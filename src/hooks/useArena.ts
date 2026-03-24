import { startTransition, useState } from "react";
import type { AgentRole, ArenaEvent, ArenaState } from "../types/arena";

const INITIAL_AGENTS: Record<AgentRole, "idle"> = {
  tutor: "idle",
  coder: "idle",
  tester: "idle",
  deployer: "idle",
};

function createInitialState(prompt = ""): ArenaState {
  return {
    status: "idle",
    prompt,
    agents: { ...INITIAL_AGENTS },
    payments: [],
    code: "",
    nft: null,
    totalPaid: 0,
  };
}

function reduceArenaState(state: ArenaState, event: ArenaEvent): ArenaState {
  switch (event.type) {
    case "agent_start":
      return {
        ...state,
        status: "running",
        code: "",
        agents: {
          ...state.agents,
          [event.agent]: "active",
        },
      };

    case "agent_complete":
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agent]: "complete",
        },
      };

    case "agent_stream":
      return {
        ...state,
        code: `${state.code}${event.content}`,
      };

    case "payment":
      return {
        ...state,
        payments: [...state.payments, event],
        totalPaid: state.totalPaid + event.amount,
      };

    case "mint":
      return {
        ...state,
        status: "complete",
        nft: event.nft,
      };

    default:
      return state;
  }
}

export function useArena() {
  const [state, setState] = useState<ArenaState>(createInitialState());

  async function startArena(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || state.status === "running") {
      return;
    }

    setState({
      ...createInitialState(trimmedPrompt),
      status: "running",
    });

    try {
      const { runArena } = await import("../agents/orchestrator");
      await runArena(trimmedPrompt, (event) => {
        startTransition(() => {
          setState((previous) => reduceArenaState(previous, event));
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown arena execution failure";

      setState((previous) => {
        const activeRole = (Object.entries(previous.agents).find(
          ([, status]) => status === "active"
        )?.[0] ?? "tutor") as AgentRole;

        return {
          ...previous,
          status: "idle",
          agents: {
            ...previous.agents,
            [activeRole]: "error",
          },
          code: `${previous.code}\n// Arena error: ${message}`,
        };
      });
    }
  }

  return {
    state,
    startArena,
    isRunning: state.status === "running",
  };
}
