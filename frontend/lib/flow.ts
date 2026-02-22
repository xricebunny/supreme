import * as fcl from "@onflow/fcl";

fcl.config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("flow.network", "testnet");
