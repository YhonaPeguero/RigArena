import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { GatePage } from "./pages/GatePage";

interface BrowserWalletProvider {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
  };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: {
      toString(): string;
    };
  }>;
  disconnect(): Promise<void>;
  on?(event: "connect" | "disconnect", listener: () => void): void;
  off?(event: "connect" | "disconnect", listener: () => void): void;
}

interface WalletSession {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  available: boolean;
}

declare global {
  interface Window {
    phantom?: {
      solana?: BrowserWalletProvider;
    };
    solana?: BrowserWalletProvider;
  }
}

function getWalletProvider(): BrowserWalletProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.phantom?.solana ?? window.solana ?? null;
}

function truncateWallet(publicKey: string | null): string {
  if (!publicKey) {
    return "Conectar Wallet";
  }

  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

export default function App() {
  const [wallet, setWallet] = useState<WalletSession>({
    connected: false,
    connecting: false,
    publicKey: null,
    available: false,
  });

  useEffect(() => {
    const provider = getWalletProvider();

    if (!provider) {
      setWallet((previous) => ({
        ...previous,
        available: false,
      }));
      return;
    }

    const syncConnectedState = () => {
      setWallet({
        connected: true,
        connecting: false,
        publicKey: provider.publicKey?.toString() ?? null,
        available: true,
      });
    };

    const syncDisconnectedState = () => {
      setWallet({
        connected: false,
        connecting: false,
        publicKey: null,
        available: true,
      });
    };

    provider.on?.("connect", syncConnectedState);
    provider.on?.("disconnect", syncDisconnectedState);

    void provider
      .connect({ onlyIfTrusted: true })
      .then(syncConnectedState)
      .catch(syncDisconnectedState);

    return () => {
      provider.off?.("connect", syncConnectedState);
      provider.off?.("disconnect", syncDisconnectedState);
    };
  }, []);

  async function connectWallet() {
    const provider = getWalletProvider();

    if (!provider) {
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }

    setWallet((previous) => ({
      ...previous,
      connecting: true,
      available: true,
    }));

    try {
      const result = await provider.connect();
      setWallet({
        connected: true,
        connecting: false,
        publicKey: result.publicKey.toString(),
        available: true,
      });
    } catch {
      setWallet((previous) => ({
        ...previous,
        connecting: false,
      }));
    }
  }

  async function disconnectWallet() {
    const provider = getWalletProvider();
    if (!provider) {
      return;
    }

    await provider.disconnect();
    setWallet({
      connected: false,
      connecting: false,
      publicKey: null,
      available: true,
    });
  }

  const walletLabel = useMemo(
    () => truncateWallet(wallet.publicKey),
    [wallet.publicKey]
  );

  return (
    <AnimatePresence mode="wait">
      {wallet.connected ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <DashboardPage
            walletLabel={walletLabel}
            onDisconnect={() => void disconnectWallet()}
          />
        </motion.div>
      ) : (
        <motion.div
          key="gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <GatePage
            connecting={wallet.connecting}
            walletAvailable={wallet.available}
            onConnect={() => void connectWallet()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
