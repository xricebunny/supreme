/** Cadence transaction templates for the frontend. */

export const SETUP_PYUSD_VAULT = `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD

transaction {
    prepare(signer: auth(SaveValue, Capabilities) &Account) {
        if signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath) != nil {
            return
        }
        let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>())
        signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath)
        let receiverCap = signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(MockPYUSD.VaultStoragePath)
        signer.capabilities.publish(receiverCap, at: MockPYUSD.ReceiverPublicPath)
        let balanceCap = signer.capabilities.storage.issue<&{FungibleToken.Balance}>(MockPYUSD.VaultStoragePath)
        signer.capabilities.publish(balanceCap, at: MockPYUSD.VaultPublicPath)
    }
}
`;

export const MINT_PYUSD = `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD

transaction(amount: UFix64) {
    prepare(signer: auth(SaveValue, Capabilities, BorrowValue) &Account) {
        // Setup vault if needed
        if signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath) == nil {
            let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>())
            signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath)
            let receiverCap = signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(MockPYUSD.VaultStoragePath)
            signer.capabilities.publish(receiverCap, at: MockPYUSD.ReceiverPublicPath)
            let balanceCap = signer.capabilities.storage.issue<&{FungibleToken.Balance}>(MockPYUSD.VaultStoragePath)
            signer.capabilities.publish(balanceCap, at: MockPYUSD.VaultPublicPath)
        }

        let mintedVault <- MockPYUSD.mint(amount: amount)
        let vaultRef = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!
        vaultRef.deposit(from: <-mintedVault)
    }
}
`;

export const OPEN_POSITION = `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD
import PredictionGame from 0xPredictionGame

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
        let vaultRef = user.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(
            from: MockPYUSD.VaultStoragePath
        ) ?? panic("Could not borrow user's PYUSD vault")

        self.userVault <- vaultRef.withdraw(amount: amount) as! @MockPYUSD.Vault
        self.userAddress = user.address

        self.admin = admin.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")
    }

    execute {
        self.admin.openPosition(
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
`;

export const GET_PYUSD_BALANCE = `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD

access(all) fun main(address: Address): UFix64 {
    let account = getAccount(address)
    let vaultRef = account.capabilities.get<&{FungibleToken.Balance}>(MockPYUSD.VaultPublicPath)
        .borrow()

    if vaultRef == nil {
        return 0.0
    }
    return vaultRef!.balance
}
`;
