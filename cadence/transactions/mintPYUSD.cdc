import "FungibleToken"
import "MockPYUSD"

/// Mint PYUSD to the signer's vault. Creates the vault if it doesn't exist.
/// Open mint — anyone can call (testnet only).
transaction(amount: UFix64) {

    prepare(signer: auth(BorrowValue, SaveValue, Capabilities) &Account) {
        // Set up vault if it doesn't exist
        if signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath) == nil {
            let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>())
            signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath)

            let vaultCap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath)
            signer.capabilities.publish(vaultCap, at: MockPYUSD.VaultPublicPath)

            let receiverCap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath)
            signer.capabilities.publish(receiverCap, at: MockPYUSD.ReceiverPublicPath)
        }

        // Mint and deposit
        let minted <- MockPYUSD.mint(amount: amount)
        let vaultRef = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!
        vaultRef.deposit(from: <-minted)
    }
}
