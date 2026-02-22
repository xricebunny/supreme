import "FungibleToken"
import "MockPYUSD"
import "PredictionGame"

/// Test-only: single signer opens a position (admin is both user and admin).
transaction(
    amount: UFix64,
    targetPrice: UFix64,
    aboveTarget: Bool,
    multiplier: UFix64,
    entryPrice: UFix64,
    durationBlocks: UInt64,
    expiryTimestamp: UFix64
) {

    let userVault: @MockPYUSD.Vault
    let admin: &PredictionGame.Admin
    let userAddress: Address

    prepare(signer: auth(BorrowValue) &Account) {
        // Withdraw PYUSD stake
        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(
            from: MockPYUSD.VaultStoragePath
        ) ?? panic("Could not borrow PYUSD vault")

        self.userVault <- vaultRef.withdraw(amount: amount) as! @MockPYUSD.Vault
        self.userAddress = signer.address

        // Borrow admin resource
        self.admin = signer.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")
    }

    execute {
        let positionId = self.admin.openPosition(
            userVault: <-self.userVault,
            owner: self.userAddress,
            targetPrice: targetPrice,
            aboveTarget: aboveTarget,
            multiplier: multiplier,
            entryPrice: entryPrice,
            durationBlocks: durationBlocks,
            expiryTimestamp: expiryTimestamp
        )
        log("Opened position: ".concat(positionId.toString()))
    }
}
