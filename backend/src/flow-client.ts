import * as fcl from "@onflow/fcl";
import elliptic from "elliptic";
const EC = elliptic.ec;
import { SHA3 } from "sha3";

const ec = new EC("p256");

// ── FCL Config ──────────────────────────────────────────────────────────────

const ADMIN_ADDRESS = process.env.FLOW_ADMIN_ADDRESS!;
const ADMIN_PRIVATE_KEY = process.env.FLOW_ADMIN_PRIVATE_KEY!;
const ACCESS_NODE = process.env.FLOW_ACCESS_NODE || "https://rest-testnet.onflow.org";

export function configureFCL() {
  fcl.config()
    .put("accessNode.api", ACCESS_NODE)
    .put("flow.network", "testnet")
    // Contract address mappings — all deployed to admin account
    .put("0xMockPYUSD", ADMIN_ADDRESS)
    .put("0xPriceOracle", ADMIN_ADDRESS)
    .put("0xPriceRangeOracle", ADMIN_ADDRESS)
    .put("0xPredictionGame", ADMIN_ADDRESS)
    // Standard Flow contracts on testnet
    .put("0xFungibleToken", "0x9a0766d93b6608b7")
    .put("0xMetadataViews", "0x631e88ae7f1d7c20")
    .put("0xFungibleTokenMetadataViews", "0x9a0766d93b6608b7");
}

// ── Key Rotation Pool (Waddle Pattern) ──────────────────────────────────────

/** Track which key indices are currently in-flight. */
const busyKeys = new Set<number>();
let totalKeys = 1; // Updated on startup by detectKeyCount()

export function setTotalKeys(count: number) {
  totalKeys = count;
}

export function getTotalKeys(): number {
  return totalKeys;
}

/** Query the admin account and count active (non-revoked) keys. */
export async function detectKeyCount(): Promise<number> {
  try {
    const account = await fcl.account(ADMIN_ADDRESS);
    const activeKeys = account.keys.filter((k: any) => !k.revoked);
    totalKeys = activeKeys.length;
    console.log(`[Keys] Detected ${totalKeys} active keys on admin account`);
    return totalKeys;
  } catch (err: any) {
    console.error(`[Keys] Failed to detect key count: ${err.message}`);
    return totalKeys;
  }
}

/** Acquire an available key index. Returns null if all keys are busy. */
function acquireKey(): number | null {
  for (let i = 0; i < totalKeys; i++) {
    if (!busyKeys.has(i)) {
      busyKeys.add(i);
      return i;
    }
  }
  return null;
}

/** Wait for a key to become available, retrying every 500ms up to maxWaitMs. */
async function acquireKeyWithWait(maxWaitMs: number = 15000): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const key = acquireKey();
    if (key !== null) return key;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("All admin keys are busy (timeout)");
}

/** Release a key index back to the pool. */
function releaseKey(index: number) {
  busyKeys.delete(index);
}

// ── Signing ─────────────────────────────────────────────────────────────────

function signWithKey(privateKey: string, message: string): string {
  const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
  const sha3 = new SHA3(256);
  sha3.update(Buffer.from(message, "hex"));
  const digest = sha3.digest();
  const sig = key.sign(digest);
  const r = sig.r.toArrayLike(Buffer, "be", 32);
  const s = sig.s.toArrayLike(Buffer, "be", 32);
  return Buffer.concat([r, s]).toString("hex");
}

// ── Authorization Function ──────────────────────────────────────────────────

/** Create an FCL authorization function for the admin account with a specific key index. */
export function adminAuthorization(keyIndex: number = 0) {
  return async (account: any) => {
    return {
      ...account,
      tempId: `${ADMIN_ADDRESS}-${keyIndex}`,
      addr: fcl.sansPrefix(ADMIN_ADDRESS),
      keyId: keyIndex,
      signingFunction: async (signable: any) => {
        return {
          addr: fcl.withPrefix(ADMIN_ADDRESS),
          keyId: keyIndex,
          signature: signWithKey(ADMIN_PRIVATE_KEY, signable.message),
        };
      },
    };
  };
}

// ── Transaction Sender (with key rotation) ──────────────────────────────────

interface TxResult {
  txId: string;
  status: number;
  events: any[];
}

/**
 * Send a transaction using key rotation.
 * Acquires a key, sends the tx, waits for seal, releases the key.
 */
export async function sendTransaction(
  cadence: string,
  args: (arg: typeof fcl.arg, t: any) => any[] = () => [],
  opts: { gasLimit?: number; waitForKey?: boolean } = {}
): Promise<TxResult> {
  let keyIndex: number;
  if (opts.waitForKey) {
    keyIndex = await acquireKeyWithWait();
  } else {
    const key = acquireKey();
    if (key === null) {
      throw new Error("All admin keys are busy");
    }
    keyIndex = key;
  }

  try {
    const authz = adminAuthorization(keyIndex);
    const txId = await fcl.mutate({
      cadence,
      args,
      limit: opts.gasLimit || 9999,
      proposer: authz as any,
      payer: authz as any,
      authorizations: [authz as any],
    });

    const result = await fcl.tx(txId).onceSealed();
    return {
      txId,
      status: result.status,
      events: result.events || [],
    };
  } finally {
    releaseKey(keyIndex);
  }
}

/**
 * Execute a read-only script.
 */
export async function executeScript(
  cadence: string,
  args: (arg: typeof fcl.arg, t: any) => any[] = () => []
): Promise<any> {
  return fcl.query({ cadence, args });
}

export { ADMIN_ADDRESS, fcl };
