import "FungibleToken"
import "MockPYUSD"

/// Get a user's MockPYUSD balance.
access(all) fun main(address: Address): UFix64 {
    let account = getAccount(address)
    let vaultRef = account.capabilities.get<&{FungibleToken.Balance}>(MockPYUSD.VaultPublicPath)
        .borrow()

    if vaultRef == nil {
        return 0.0
    }
    return vaultRef!.balance
}
