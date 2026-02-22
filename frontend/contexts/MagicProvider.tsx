"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MagicInstance = any;

interface MagicContextValue {
  magic: MagicInstance | null;
}

const MagicContext = createContext<MagicContextValue>({ magic: null });

export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<MagicInstance | null>(null);

  useEffect(() => {
    (async () => {
      const { Magic } = await import("magic-sdk");
      const { FlowExtension } = await import("@magic-ext/flow");
      const m = new Magic("pk_live_1B1561D615BE0919", {
        extensions: [
          new FlowExtension({
            rpcUrl: "https://rest-testnet.onflow.org",
            network: "testnet",
          }),
        ],
      });
      setMagic(m);
    })();
  }, []);

  return (
    <MagicContext.Provider value={{ magic }}>
      {children}
    </MagicContext.Provider>
  );
}

export function useMagic() {
  return useContext(MagicContext);
}
