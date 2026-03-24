import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ArenaEvent } from "../types/arena";

interface DeployerInput {
  prompt: string;
  testReport: string;
}

function createMockAddress(seed: string, length = 44): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const code = seed.charCodeAt(index % seed.length) + index * 11;
    value += alphabet[code % alphabet.length];
  }
  return value;
}

function buildNftImage(prompt: string): string {
  const label = prompt.slice(0, 28) || "RigArena";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1220" />
        <stop offset="45%" stop-color="#1d1038" />
        <stop offset="100%" stop-color="#f7c948" />
      </linearGradient>
      <radialGradient id="flare" cx="50%" cy="32%" r="55%">
        <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.95" />
        <stop offset="100%" stop-color="#67e8f9" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="600" height="600" rx="36" fill="url(#bg)" />
    <rect x="34" y="34" width="532" height="532" rx="30" fill="none" stroke="rgba(255,255,255,0.16)" />
    <circle cx="300" cy="184" r="170" fill="url(#flare)" />
    <path d="M152 360C204 296 266 262 338 256C412 250 456 284 470 358C412 406 344 432 266 438C210 424 172 398 152 360Z" fill="#0e1a2b" stroke="#f7c948" stroke-width="8" />
    <path d="M188 346L246 258L318 332L388 234L446 344" fill="none" stroke="#67e8f9" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    <text x="52" y="86" fill="#d7f9ff" font-size="30" font-family="IBM Plex Sans, sans-serif" letter-spacing="6">PROOF OF BUILD</text>
    <text x="52" y="520" fill="#ffffff" font-size="42" font-family="Bricolage Grotesque, sans-serif">${label}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function streamFallback(value: string, onToken: (token: string) => void) {
  for (const token of value) {
    onToken(token);
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
}

export async function runDeployer(
  input: DeployerInput,
  onToken: (token: string) => void,
  onEvent: (event: ArenaEvent) => void
): Promise<string> {
  const mockProgramId =
    import.meta.env.VITE_PROGRAM_ID || createMockAddress(`program-${input.prompt}`);
  const mint = createMockAddress(`mint-${input.prompt}`);
  const blinkUrl = `https://dial.to/?action=solana-action:https://rigarena.dev/api/blink/${mint}`;
  const fallback = `anchor build
Build successful.

anchor deploy --provider.cluster devnet
Program ID: ${mockProgramId}
Blink: ${blinkUrl}

Verifier summary:
${input.testReport}
`;

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  let output = "";

  if (apiKey) {
    try {
      const anthropic = createAnthropic({ apiKey });
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system:
          "You are the RigArena Deployer agent. Simulate an Anchor build and deploy summary, include a Program ID and a Blink URL, and keep the output crisp.",
        prompt: `${input.prompt}\n\n${input.testReport}`,
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
    type: "mint",
    nft: {
      name: `Proof of Build -- ${input.prompt.slice(0, 28)}`,
      description:
        "Soulbound proof emitted by the winning RigArena deployer after a full Solana learning run.",
      mint,
      image: buildNftImage(input.prompt),
    },
  });

  return output || fallback;
}
