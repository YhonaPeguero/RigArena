/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_HELIUS_API_KEY: string;
  readonly VITE_HELIUS_RPC_URL: string;
  readonly VITE_PROGRAM_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
