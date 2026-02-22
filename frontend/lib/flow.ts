import * as fcl from "@onflow/fcl";

const ADMIN_ADDRESS = "0xb36266e524c6c727";

fcl.config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("flow.network", "testnet")
  // Contract address mappings
  .put("0xMockPYUSD", ADMIN_ADDRESS)
  .put("0xPriceOracle", ADMIN_ADDRESS)
  .put("0xPredictionGame", ADMIN_ADDRESS)
  .put("0xFungibleToken", "0x9a0766d93b6608b7")
  .put("0xMetadataViews", "0x631e88ae7f1d7c20")
  .put("0xFungibleTokenMetadataViews", "0x9a0766d93b6608b7");

export { ADMIN_ADDRESS };
