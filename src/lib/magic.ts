"use client";

import { Magic } from "magic-sdk";
import { FlowExtension } from "@magic-ext/flow";

// Magic.link configuration for Flow
const MAGIC_API_KEY = process.env.NEXT_PUBLIC_MAGIC_API_KEY || "";

// Demo mode - works without real API key
const DEMO_MODE = !MAGIC_API_KEY || MAGIC_API_KEY === "pk_live_YOUR_MAGIC_API_KEY_HERE";

// Flow network configuration
const FLOW_NETWORK = {
  rpcUrl: "https://rest-testnet.onflow.org",
  network: "testnet" as const,
};

let magicInstance: Magic | null = null;

// Initialize Magic with Flow extension
export const getMagic = () => {
  if (typeof window === "undefined") return null;
  if (DEMO_MODE) return null;

  if (!magicInstance && MAGIC_API_KEY) {
    magicInstance = new Magic(MAGIC_API_KEY, {
      extensions: [new FlowExtension(FLOW_NETWORK)],
    });
  }

  return magicInstance;
};

// Login with email
export const loginWithEmail = async (email: string) => {
  if (DEMO_MODE) {
    console.log("[DEMO] Login with email:", email);
    return "demo-token";
  }

  const magic = getMagic();
  if (!magic) throw new Error("Magic not initialized");

  try {
    const didToken = await magic.auth.loginWithMagicLink({ email });
    return didToken;
  } catch (error) {
    console.error("Magic login error:", error);
    throw error;
  }
};

// Login with social provider
export const loginWithSocial = async (provider: "google" | "twitter" | "discord") => {
  if (DEMO_MODE) {
    console.log("[DEMO] Login with provider:", provider);
    return "demo-token";
  }

  const magic = getMagic();
  if (!magic) throw new Error("Magic not initialized");

  try {
    const didToken = await magic.oauth.loginWithRedirect({
      provider,
      redirectURI: `${window.location.origin}/callback`,
    });
    return didToken;
  } catch (error) {
    console.error("Magic social login error:", error);
    throw error;
  }
};

// Logout
export const logout = async () => {
  if (DEMO_MODE) {
    console.log("[DEMO] Logout");
    return;
  }

  const magic = getMagic();
  if (!magic) throw new Error("Magic not initialized");

  try {
    await magic.user.logout();
  } catch (error) {
    console.error("Magic logout error:", error);
    throw error;
  }
};

// Get user info
export const getUserInfo = async () => {
  if (DEMO_MODE) {
    return { email: "demo@emerpus.finance" };
  }

  const magic = getMagic();
  if (!magic) throw new Error("Magic not initialized");

  try {
    const isLoggedIn = await magic.user.isLoggedIn();
    if (!isLoggedIn) return null;

    const userInfo = await magic.user.getInfo();
    return userInfo;
  } catch (error) {
    console.error("Magic get user error:", error);
    return null;
  }
};

// Check if user is logged in
export const isLoggedIn = async () => {
  if (DEMO_MODE) return false; // Start logged out in demo

  const magic = getMagic();
  if (!magic) return false;

  try {
    return await magic.user.isLoggedIn();
  } catch {
    return false;
  }
};

// Get Flow public address from Magic
export const getFlowAddress = async (): Promise<string | null> => {
  if (DEMO_MODE) {
    return "0xDEMO1234567890";
  }

  const magic = getMagic();
  if (!magic) return null;

  try {
    const metadata = await magic.user.getInfo();
    return metadata.publicAddress || null;
  } catch {
    return null;
  }
};

// Export demo mode status
export const isDemoMode = () => DEMO_MODE;
