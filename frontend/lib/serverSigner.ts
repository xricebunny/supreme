import * as fcl from "@onflow/fcl";
import { signTransaction } from "./api";
import { ADMIN_ADDRESS } from "./flow";

/**
 * FCL authorization function for the backend admin.
 * Used as the second authorizer in multi-auth bet transactions.
 * The backend signs the transaction via POST /api/sign.
 */
export function serverAuthorization() {
  return async (account: any) => {
    return {
      ...account,
      tempId: `${ADMIN_ADDRESS}-0`,
      addr: fcl.sansPrefix(ADMIN_ADDRESS),
      keyId: 0,
      signingFunction: async (signable: any) => {
        const response = await signTransaction(signable.message);
        return {
          addr: fcl.withPrefix(ADMIN_ADDRESS),
          keyId: response.keyId,
          signature: response.signature,
        };
      },
    };
  };
}
