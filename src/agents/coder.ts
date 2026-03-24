import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ArenaEvent } from "../types/arena";

function createMockSignature(seed: string): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = "";
  for (let index = 0; index < 88; index += 1) {
    const code = seed.charCodeAt(index % seed.length) + index * 17;
    value += alphabet[code % alphabet.length];
  }
  return value;
}

async function streamFallback(value: string, onToken: (token: string) => void) {
  for (const token of value) {
    onToken(token);
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
}

export async function runCoder(
  subtasks: string,
  onToken: (token: string) => void,
  onEvent: (event: ArenaEvent) => void
): Promise<string> {
  const fallback = `use anchor_lang::prelude::*;

#[account]
pub struct ArenaSession {
    pub authority: Pubkey,
    pub prompt: String,
    pub total_paid: u64,
    pub minted: bool,
}

pub fn pay_agent(ctx: Context<PayAgent>, amount: u64) -> Result<()> {
    // Move micro-USDC between role vaults and record the arena tally.
    let session = &mut ctx.accounts.session;
    session.total_paid = session.total_paid.checked_add(amount).unwrap();
    Ok(())
}

pub fn mint_proof(ctx: Context<MintProof>) -> Result<()> {
    // Lock the session, record the winner, and emit the proof mint event.
    ctx.accounts.session.minted = true;
    Ok(())
}
`;

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  let output = "";

  if (apiKey) {
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system:
          "You are the RigArena Coder agent. Produce valid Anchor/Rust code with concise comments. Focus on session state, agent vault payments, events, and a proof mint flow. Prefer concrete code over prose.",
        prompt: subtasks,
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
    from: "coder",
    to: "tester",
    amount: 0.001,
    tx: createMockSignature(`coder-${subtasks}`),
    timestamp: Date.now(),
  });

  return output || fallback;
}
