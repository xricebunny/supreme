import * as fcl from "@onflow/fcl";
import { FlowTransaction } from "@/types";

// Demo mode - all transactions are mocked
const DEMO_MODE = true; // Set to false after deploying contract

// Flow Testnet Configuration
export const flowConfig = {
  "app.detail.title": "Emerpus",
  "app.detail.icon": "https://placekitten.com/g/200/200",
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "flow.network": "testnet",
};

// Contract addresses (update these after deployment)
const CONTRACT_ADDRESS = "0xYOUR_CONTRACT_ADDRESS"; // TODO: Set after deploy
const ORACLE_ADDRESS = "0xYOUR_ORACLE_ADDRESS"; // PublicPriceOracle address

// Initialize FCL
export const initFCL = () => {
  fcl.config(flowConfig);
};

// Authentication
export const authenticate = () => fcl.authenticate();
export const unauthenticate = () => fcl.unauthenticate();
export const currentUser = fcl.currentUser;

export const getUserAddress = async (): Promise<string | null> => {
  const user = await fcl.currentUser.snapshot();
  return user.addr;
};

// Mock transaction result for demo mode
const mockTxResult = (positionId?: string): FlowTransaction => ({
  status: 4,
  statusString: "SEALED",
  errorMessage: "",
  events: positionId ? [{ type: "PositionOpened", data: { positionId } }] : [],
  transactionId: `demo-tx-${Date.now()}`,
});

// Execute script
export const executeScript = async (script: string, args: any[] = []) => {
  const response = await fcl.query({
    cadence: script,
    args: (arg: any, t: any) => args,
  });
  return response;
};

// Send transaction
export const sendTransaction = async (
  transaction: string,
  args: any[] = [],
  limit: number = 9999
): Promise<FlowTransaction> => {
  const transactionId = await fcl.mutate({
    cadence: transaction,
    args: (arg: any, t: any) => args,
    limit,
  });

  const result = await fcl.tx(transactionId).onceSealed();
  return {
    ...result,
    transactionId,
  };
};

// ============================================================================
// Contract Transactions
// ============================================================================

// Open a new position (place bet)
export const openPosition = async (
  row: number,
  col: number,
  amount: number
): Promise<FlowTransaction> => {
  // Demo mode - instant mock response
  if (DEMO_MODE) {
    console.log(`[DEMO] Opening position: row=${row}, col=${col}, amount=${amount}`);
    await new Promise(r => setTimeout(r, 300)); // Simulate network delay
    return mockTxResult(`pos-${Date.now()}`);
  }

  const cadence = `
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868
    // import MicroOptionsMVP from ${CONTRACT_ADDRESS}

    transaction(row: Int, col: Int, amount: UFix64) {
      prepare(signer: AuthAccount) {
        log("Opening position")
      }
    }
  `;

  try {
    return await sendTransaction(
      cadence,
      (arg: any, t: any) => [
        arg(row, t.Int),
        arg(col, t.Int),
        arg(amount.toFixed(8), t.UFix64),
      ]
    );
  } catch (error) {
    console.error("openPosition error:", error);
    return mockTxResult(`pos-${Date.now()}`);
  }
};

// Settle a position after expiry
export const settlePosition = async (
  positionId: string
): Promise<FlowTransaction> => {
  if (DEMO_MODE) {
    console.log(`[DEMO] Settling position: ${positionId}`);
    await new Promise(r => setTimeout(r, 300));
    return mockTxResult();
  }

  const cadence = `
    transaction(positionId: String) {
      prepare(signer: AuthAccount) {
        log("Settling position")
      }
    }
  `;

  try {
    return await sendTransaction(
      cadence,
      (arg: any, t: any) => [arg(positionId, t.String)]
    );
  } catch (error) {
    console.error("settlePosition error:", error);
    return mockTxResult();
  }
};

// Cancel a position (emergency refund)
export const cancelPosition = async (
  positionId: string
): Promise<FlowTransaction> => {
  if (DEMO_MODE) {
    console.log(`[DEMO] Canceling position: ${positionId}`);
    await new Promise(r => setTimeout(r, 300));
    return mockTxResult();
  }

  const cadence = `
    transaction(positionId: String) {
      prepare(signer: AuthAccount) {
        log("Canceling position")
      }
    }
  `;

  try {
    return await sendTransaction(
      cadence,
      (arg: any, t: any) => [arg(positionId, t.String)]
    );
  } catch (error) {
    console.error("cancelPosition error:", error);
    return mockTxResult();
  }
};

// Fund house vault (admin only)
export const fundHouse = async (amount: number): Promise<FlowTransaction> => {
  if (DEMO_MODE) {
    console.log(`[DEMO] Funding house: ${amount}`);
    await new Promise(r => setTimeout(r, 300));
    return mockTxResult();
  }

  const cadence = `
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction(amount: UFix64) {
      prepare(signer: AuthAccount) {
        log("Funding house")
      }
    }
  `;

  try {
    return await sendTransaction(
      cadence,
      (arg: any, t: any) => [arg(amount.toFixed(8), t.UFix64)]
    );
  } catch (error) {
    console.error("fundHouse error:", error);
    return mockTxResult();
  }
};

// ============================================================================
// Contract Scripts (read-only queries)
// ============================================================================

// Get oracle snapshot
export const getOracleSnapshot = async () => {
  const cadence = `
    // import PublicPriceOracle from ${ORACLE_ADDRESS}

    pub fun main(): {String: AnyStruct} {
      // let price = PublicPriceOracle.getLatestPrice()
      // let block = PublicPriceOracle.getLatestBlockHeight()
      // return {
      //   "price": price,
      //   "updatedAtBlock": block,
      //   "currentBlock": getCurrentBlock().height
      // }
      
      // Mock for demo
      return {
        "price": 100.50,
        "updatedAtBlock": UInt64(1000000),
        "currentBlock": getCurrentBlock().height
      }
    }
  `;

  try {
    return await executeScript(cadence);
  } catch (error) {
    console.error("getOracleSnapshot error:", error);
    return {
      price: 100.5,
      updatedAtBlock: 1000000,
      currentBlock: 1000010,
    };
  }
};

// Get position by ID
export const getPosition = async (positionId: string) => {
  const cadence = `
    // import MicroOptionsMVP from ${CONTRACT_ADDRESS}

    pub fun main(positionId: String): {String: AnyStruct}? {
      // return MicroOptionsMVP.getPosition(positionId: positionId)
      return nil
    }
  `;

  try {
    return await executeScript(
      cadence,
      (arg: any, t: any) => [arg(positionId, t.String)]
    );
  } catch (error) {
    console.error("getPosition error:", error);
    return null;
  }
};

// List positions for user
export const listPositionsForUser = async (address: string) => {
  const cadence = `
    // import MicroOptionsMVP from ${CONTRACT_ADDRESS}

    pub fun main(address: Address): [{String: AnyStruct}] {
      // return MicroOptionsMVP.listPositionsForUser(address: address)
      return []
    }
  `;

  try {
    return await executeScript(
      cadence,
      (arg: any, t: any) => [arg(address, t.Address)]
    );
  } catch (error) {
    console.error("listPositionsForUser error:", error);
    return [];
  }
};

// Get user's Flow token balance
export const getFlowBalance = async (address: string): Promise<number> => {
  const cadence = `
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    pub fun main(address: Address): UFix64 {
      let account = getAccount(address)
      let vaultRef = account.getCapability(/public/flowTokenBalance)
        .borrow<&FlowToken.Vault{FungibleToken.Balance}>()
        ?? panic("Could not borrow Balance reference")
      return vaultRef.balance
    }
  `;

  try {
    const result = await executeScript(
      cadence,
      (arg: any, t: any) => [arg(address, t.Address)]
    );
    return parseFloat(result);
  } catch (error) {
    console.error("getFlowBalance error:", error);
    return 0;
  }
};
