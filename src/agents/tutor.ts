import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ArenaEvent } from "../types/arena";

function createMockSignature(seed: string): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = "";
  for (let index = 0; index < 88; index += 1) {
    const code = seed.charCodeAt(index % seed.length) + index * 13;
    value += alphabet[code % alphabet.length];
  }
  return value;
}

async function streamFallback(value: string, onToken: (token: string) => void) {
  for (const token of value) {
    onToken(token);
    await new Promise((resolve) => window.setTimeout(resolve, 8));
  }
}

export async function runTutor(
  prompt: string,
  onToken: (token: string) => void,
  onEvent: (event: ArenaEvent) => void
): Promise<string> {
  const fallback = `{
  "subtasks": [
    {
      "title": "Model the arena accounts",
      "goal": "Define ArenaSession, AgentVault, ProofNFT PDAs and lifecycle flags for the prompt: ${prompt.slice(0, 52)}"
    },
    {
      "title": "Implement the learning flow",
      "goal": "Write the Anchor instruction path initialize_arena -> pay_agent -> mint_proof with explicit events and guarded state transitions."
    },
    {
      "title": "Prepare the visual proof",
      "goal": "Connect coder output, tester validation, and deployer summary so the frontend can stream code, coins, and the final NFT reveal."
    }
  ]
}`;

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  let output = "";

  if (apiKey) {
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system:
          "You are the RigArena Tutor agent. Return valid JSON only. Break the user Solana learning prompt into exactly three concrete subtasks. Each item must include title and goal.",
        prompt,
      });

      for await (const token of result.textStream) {
        output += token;
        onToken(token);
      }
    } catch {
      output = fallback;
      await streamFallback(fallback, onToken);
    }
  } else {
    output = fallback;
    await streamFallback(fallback, onToken);
  }

  onEvent({
    type: "payment",
    from: "tutor",
    to: "coder",
    amount: 0.001,
    tx: createMockSignature(`tutor-${prompt}`),
    timestamp: Date.now(),
  });

  return output || fallback;
}
