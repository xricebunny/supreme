import Test

access(all) let admin = Test.getAccount(0x0000000000000007)
access(all) let user = Test.createAccount()
access(all) let ADDR = "0x0000000000000007"
// Test emulator standard contract addresses
access(all) let FT_ADDR = "0x0000000000000002"

/// Replace string-based imports with address-based imports for the test emulator.
access(all)
fun resolveImports(_ code: String): String {
    var resolved = code
    resolved = resolved.replaceAll(of: "import \"FungibleToken\"", with: "import FungibleToken from 0x0000000000000002")
    resolved = resolved.replaceAll(of: "import \"FungibleTokenMetadataViews\"", with: "import FungibleTokenMetadataViews from 0x0000000000000002")
    resolved = resolved.replaceAll(of: "import \"MetadataViews\"", with: "import MetadataViews from 0x0000000000000001")
    resolved = resolved.replaceAll(of: "import \"ViewResolver\"", with: "import ViewResolver from 0x0000000000000001")
    resolved = resolved.replaceAll(of: "import \"Burner\"", with: "import Burner from 0x0000000000000001")
    resolved = resolved.replaceAll(of: "import \"MockPYUSD\"", with: "import MockPYUSD from 0x0000000000000007")
    resolved = resolved.replaceAll(of: "import \"PriceOracle\"", with: "import PriceOracle from 0x0000000000000007")
    resolved = resolved.replaceAll(of: "import \"PriceRangeOracle\"", with: "import PriceRangeOracle from 0x0000000000000007")
    resolved = resolved.replaceAll(of: "import \"PredictionGame\"", with: "import PredictionGame from 0x0000000000000007")
    return resolved
}

access(all)
fun deployContract(_ name: String, _ path: String) {
    let code = resolveImports(Test.readFile(path))
    let deployTx = Test.Transaction(
        code: "transaction(name: String, code: String) { prepare(signer: auth(Contracts) &Account) { signer.contracts.add(name: name, code: code.utf8) } }",
        authorizers: [admin.address],
        signers: [admin],
        arguments: [name, code]
    )
    let result = Test.executeTransaction(deployTx)
    Test.expect(result, Test.beSucceeded())
}

access(all)
fun setup() {
    // Deploy dependencies in order
    deployContract("MockPYUSD", "../contracts/MockPYUSD.cdc")
    deployContract("PriceOracle", "../contracts/PriceOracle.cdc")
    deployContract("PriceRangeOracle", "../contracts/PriceRangeOracle.cdc")
    deployContract("PredictionGame", "../contracts/PredictionGame.cdc")

    // Setup user PYUSD vault
    let setupVault = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; import FungibleToken from ").concat(FT_ADDR).concat("; transaction { prepare(signer: auth(SaveValue, Capabilities) &Account) { let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>()); signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath); let cap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath); signer.capabilities.publish(cap, at: MockPYUSD.VaultPublicPath); let rcap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath); signer.capabilities.publish(rcap, at: MockPYUSD.ReceiverPublicPath) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: []
    )
    Test.expect(Test.executeTransaction(setupVault), Test.beSucceeded())

    // Fund house with 100,000 PYUSD
    let fundTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat("; transaction(amount: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)!; let vault <- MockPYUSD.mint(amount: amount); a.fundHouse(from: <-vault) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [100000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(fundTx), Test.beSucceeded())

    // Mint PYUSD for user
    let mintTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; transaction(amount: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let minted <- MockPYUSD.mint(amount: amount); let ref = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; ref.deposit(from: <-minted) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: [1000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(mintTx), Test.beSucceeded())

    // Push initial oracle price
    let pushPrice = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(price: UFix64, ts: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.pushPrice(price: price, timestamp: ts) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [96500.0 as UFix64, 1711700000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushPrice), Test.beSucceeded())
}

// ── Configuration Tests ─────────────────────────────────────────────────

access(all)
fun testInitialConfig() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): [UFix64] { return [PredictionGame.maxMultiplier, PredictionGame.minMultiplier] }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    let vals = result.returnValue! as! [UFix64]
    Test.assertEqual(100.0, vals[0])
    Test.assertEqual(1.0, vals[1])
}

access(all)
fun testEmergencyTimeoutBlocks() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PredictionGame.emergencyTimeoutBlocks }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(400 as UInt64, result.returnValue! as! UInt64)
}

// ── House Funding ───────────────────────────────────────────────────────

access(all)
fun testHouseIsFunded() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): UFix64 { return PredictionGame.getHouseBalance() }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    let balance = result.returnValue! as! UFix64
    Test.assert(balance >= 100000.0)
}

// ── Open Position ───────────────────────────────────────────────────────

access(all)
fun testOpenPosition() {
    let openTx = Test.Transaction(
        code: "import FungibleToken from ".concat(FT_ADDR).concat("; import MockPYUSD from ").concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat("; transaction(amount: UFix64, targetPrice: UFix64, aboveTarget: Bool, multiplier: UFix64, entryPrice: UFix64, durationBlocks: UInt64, expiryTimestamp: UFix64) { let userVault: @MockPYUSD.Vault; let adminRef: &PredictionGame.Admin; let userAddr: Address; prepare(userAcct: auth(BorrowValue) &Account, adminAcct: auth(BorrowValue) &Account) { let v = userAcct.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; self.userVault <- v.withdraw(amount: amount) as! @MockPYUSD.Vault; self.userAddr = userAcct.address; self.adminRef = adminAcct.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)! } execute { self.adminRef.openPosition(userVault: <-self.userVault, owner: self.userAddr, targetPrice: targetPrice, aboveTarget: aboveTarget, multiplier: multiplier, entryPrice: entryPrice, durationBlocks: durationBlocks, expiryTimestamp: expiryTimestamp) } }"),
        authorizers: [user.address, admin.address],
        signers: [user, admin],
        arguments: [
            10.0 as UFix64,
            97000.0 as UFix64,
            true as Bool,
            2.0 as UFix64,
            96500.0 as UFix64,
            5 as UInt64,
            1711700050.0 as UFix64
        ]
    )
    Test.expect(Test.executeTransaction(openTx), Test.beSucceeded())

    let countResult = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PredictionGame.getPositionCount() }"),
        []
    )
    Test.expect(countResult, Test.beSucceeded())
    let count = countResult.returnValue! as! UInt64
    Test.assert(count > 0 as UInt64)
}

access(all)
fun testPositionHasCorrectFields() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): [UFix64] { let count = PredictionGame.getPositionCount(); let pos = PredictionGame.getPosition(positionId: count)!; return [pos.stake, pos.targetPrice, pos.multiplier] }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    let vals = result.returnValue! as! [UFix64]
    Test.assertEqual(10.0, vals[0])
    Test.assertEqual(97000.0, vals[1])
    Test.assertEqual(2.0, vals[2])
}

access(all)
fun testPositionNotSettled() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): Bool { let count = PredictionGame.getPositionCount(); let pos = PredictionGame.getPosition(positionId: count)!; return pos.settled }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(false, result.returnValue! as! Bool)
}

// ── Validation ──────────────────────────────────────────────────────────

access(all)
fun testOpenPositionRejectsZeroStake() {
    let openTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat("; transaction { let vault: @MockPYUSD.Vault; let adminRef: &PredictionGame.Admin; prepare(userAcct: auth(BorrowValue) &Account, adminAcct: auth(BorrowValue) &Account) { self.vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>()) as! @MockPYUSD.Vault; self.adminRef = adminAcct.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)! } execute { self.adminRef.openPosition(userVault: <-self.vault, owner: 0x1, targetPrice: 97000.0, aboveTarget: true, multiplier: 2.0, entryPrice: 96500.0, durationBlocks: 10, expiryTimestamp: 1711700050.0) } }"),
        authorizers: [user.address, admin.address],
        signers: [user, admin],
        arguments: []
    )
    Test.expect(Test.executeTransaction(openTx), Test.beFailed())
}

access(all)
fun testOpenPositionRejectsMultiplierAboveMax() {
    let openTx = Test.Transaction(
        code: "import FungibleToken from ".concat(FT_ADDR).concat("; import MockPYUSD from ").concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat("; transaction { let vault: @MockPYUSD.Vault; let adminRef: &PredictionGame.Admin; prepare(userAcct: auth(BorrowValue) &Account, adminAcct: auth(BorrowValue) &Account) { let v = userAcct.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; self.vault <- v.withdraw(amount: 10.0) as! @MockPYUSD.Vault; self.adminRef = adminAcct.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)! } execute { self.adminRef.openPosition(userVault: <-self.vault, owner: 0x1, targetPrice: 97000.0, aboveTarget: true, multiplier: 200.0, entryPrice: 96500.0, durationBlocks: 10, expiryTimestamp: 1711700050.0) } }"),
        authorizers: [user.address, admin.address],
        signers: [user, admin],
        arguments: []
    )
    Test.expect(Test.executeTransaction(openTx), Test.beFailed())
}

access(all)
fun testOpenPositionRejectsMultiplierBelowMin() {
    let openTx = Test.Transaction(
        code: "import FungibleToken from ".concat(FT_ADDR).concat("; import MockPYUSD from ").concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat("; transaction { let vault: @MockPYUSD.Vault; let adminRef: &PredictionGame.Admin; prepare(userAcct: auth(BorrowValue) &Account, adminAcct: auth(BorrowValue) &Account) { let v = userAcct.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; self.vault <- v.withdraw(amount: 10.0) as! @MockPYUSD.Vault; self.adminRef = adminAcct.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)! } execute { self.adminRef.openPosition(userVault: <-self.vault, owner: 0x1, targetPrice: 97000.0, aboveTarget: true, multiplier: 0.5, entryPrice: 96500.0, durationBlocks: 10, expiryTimestamp: 1711700050.0) } }"),
        authorizers: [user.address, admin.address],
        signers: [user, admin],
        arguments: []
    )
    Test.expect(Test.executeTransaction(openTx), Test.beFailed())
}

// ── View Functions ──────────────────────────────────────────────────────

access(all)
fun testListUserPositions() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(addr: Address): Int { return PredictionGame.listUserPositions(address: addr).length }"),
        [user.address]
    )
    Test.expect(result, Test.beSucceeded())
    let count = result.returnValue! as! Int
    Test.assert(count > 0)
}

access(all)
fun testGetNonexistentPosition() {
    let result = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat("; access(all) fun main(): Bool { return PredictionGame.getPosition(positionId: 999999) == nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}
