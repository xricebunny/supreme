import "FungibleToken"
import "MockPYUSD"
import "PredictionGame"

/// Admin funds the house vault with PYUSD for payouts.
transaction(amount: UFix64) {

    let admin: &PredictionGame.Admin
    let pyusdVault: @MockPYUSD.Vault

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")

        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(
            from: MockPYUSD.VaultStoragePath
        ) ?? panic("Could not borrow PYUSD vault")

        self.pyusdVault <- vaultRef.withdraw(amount: amount) as! @MockPYUSD.Vault
    }

    execute {
        self.admin.fundHouse(from: <-self.pyusdVault)
    }
}
