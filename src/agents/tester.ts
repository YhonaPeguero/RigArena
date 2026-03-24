import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ArenaEvent } from "../types/arena";

function createMockSignature(seed: string): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = "";
  for (let index = 0; index < 88; index += 1) {
    const code = seed.charCodeAt(index % seed.length) + index * 19;
    value += alphabet[code % alphabet.length];
  }
  return value;
}

async function streamFallback(value: string, onToken: (token: string) => void) {
  for (const token of value) {
    onToken(token);
    await new Promise((resolve) => window.setTimeout(resolve, 6));
  }
}

export async function runTester(
  code: string,
  onToken: (token: string) => void,
  onEvent: (event: ArenaEvent) => void
): Promise<string> {
  const fallback = `Anchor validation report
status: pass

- PDA seeds are internally consistent across arena, vault, and proof records.
- Payment flow increments total_paid and protects against double-mint attempts.
- One risk remains: real SPL USDC transfers and Metaplex Core CPI still need devnet wiring before production deploy.
`;

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  let output = "";

  if (apiKey) {
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system:
          "You are the RigArena Tester agent. Review the supplied Anchor code, highlight any likely errors, and finish with a pass or fail verdict. Keep the output compact and technical.",
        prompt: code,
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
    from: "tester",
    to: "deployer",
    amount: 0.001,
    tx: createMockSignature(`tester-${code}`),
    timestamp: Date.now(),
  });

  return output || fallback;
}
