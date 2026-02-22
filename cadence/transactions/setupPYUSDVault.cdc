import "FungibleToken"
import "MockPYUSD"

/// Set up a MockPYUSD vault in the signer's account if one doesn't exist.
transaction {

    prepare(signer: auth(BorrowValue, SaveValue, Capabilities) &Account) {
        if signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath) != nil {
            return
        }

        let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>())
        signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath)

        let vaultCap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath)
        signer.capabilities.publish(vaultCap, at: MockPYUSD.VaultPublicPath)

        let receiverCap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath)
        signer.capabilities.publish(receiverCap, at: MockPYUSD.ReceiverPublicPath)
    }
}
