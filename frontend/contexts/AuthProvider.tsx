"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import * as fcl from "@onflow/fcl";
import "@/lib/flow";
import { useMagic } from "./MagicProvider";

interface AuthContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
  email: string | null;
  address: string | null;
  balance: number | null;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  isLoading: false,
  email: null,
  address: null,
  balance: null,
  login: async () => {},
  logout: async () => {},
  refreshBalance: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { magic } = useMagic();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const refreshBalance = useCallback(async (addr?: string) => {
    const target = addr || address;
    if (!target) return;
    try {
      const account = await fcl.account(target);
      // Flow balance is in UFix64 (8 decimal places), FCL returns it as a string in "drops"
      setBalance(Number(account.balance) / 100_000_000);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, [address]);

  // Check for existing session on mount
  useEffect(() => {
    if (!magic) return;

    let cancelled = false;

    const checkSession = async () => {
      try {
        const loggedIn = await magic.user.isLoggedIn();
        if (cancelled) return;

        if (loggedIn) {
          const metadata = await magic.user.getInfo();
          if (cancelled) return;

          // Get Flow address from the Flow extension (getInfo only returns ETH address)
          let flowAddress: string | null = null;
          try {
            const flowAccount = await magic.flow.getAccount();
            flowAddress = flowAccount ?? null;
          } catch {
            // Flow account not yet created
          }

          setEmail(metadata.email ?? null);
          setAddress(flowAddress);
          setIsLoggedIn(true);
          if (flowAddress) {
            await refreshBalance(flowAddress);
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkSession();
    return () => { cancelled = true; };
  }, [magic, refreshBalance]);

  const login = useCallback(async (emailInput: string) => {
    if (!magic) return;
    setIsLoading(true);
    try {
      await magic.auth.loginWithEmailOTP({ email: emailInput, showUI: true });
      const metadata = await magic.user.getInfo();

      // Get Flow address from the Flow extension (getInfo only returns ETH address)
      let flowAddress: string | null = null;
      try {
        const flowAccount = await magic.flow.getAccount();
        flowAddress = flowAccount ?? null;
      } catch {
        // Flow account not yet created
      }

      setEmail(metadata.email ?? null);
      setAddress(flowAddress);
      setIsLoggedIn(true);
      if (flowAddress) {
        await refreshBalance(flowAddress);
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [magic, refreshBalance]);

  const logout = useCallback(async () => {
    if (!magic) return;
    setIsLoading(true);
    try {
      await magic.user.logout();
    } finally {
      setIsLoggedIn(false);
      setEmail(null);
      setAddress(null);
      setBalance(null);
      setIsLoading(false);
    }
  }, [magic]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        email,
        address,
        balance,
        login,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
