import "FungibleToken"
import "MockPYUSD"
import "FlowPredictionGame"

/// Admin funds the Flow house vault with PYUSD for payouts.
transaction(amount: UFix64) {

    let admin: &FlowPredictionGame.Admin
    let pyusdVault: @MockPYUSD.Vault

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&FlowPredictionGame.Admin>(
            from: FlowPredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow FlowPredictionGame Admin")

        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(
            from: MockPYUSD.VaultStoragePath
        ) ?? panic("Could not borrow PYUSD vault")

        self.pyusdVault <- vaultRef.withdraw(amount: amount) as! @MockPYUSD.Vault
    }

    execute {
        self.admin.fundHouse(from: <-self.pyusdVault)
    }
}
