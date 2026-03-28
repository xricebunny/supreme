import "FungibleToken"
import "MockPYUSD"
import "PredictionGame"

/// Multi-auth transaction: user provides PYUSD, admin co-signs.
/// User = first authorizer (provides the stake from their vault)
/// Admin = second authorizer (borrows Admin resource to open position)
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

    prepare(user: auth(BorrowValue) &Account, admin: auth(BorrowValue) &Account) {
        // User withdraws PYUSD stake
        let vaultRef = user.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(
            from: MockPYUSD.VaultStoragePath
        ) ?? panic("Could not borrow user's PYUSD vault")

        self.userVault <- vaultRef.withdraw(amount: amount) as! @MockPYUSD.Vault
        self.userAddress = user.address

        // Admin borrows the game admin resource
        self.admin = admin.storage.borrow<&PredictionGame.Admin>(
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
    }
}
