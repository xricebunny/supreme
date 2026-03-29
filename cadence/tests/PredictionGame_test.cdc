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

// ── Settlement Helpers ─────────────────────────────────────────────────

access(all)
fun pushTestPrice(_ price: UFix64, _ timestamp: UFix64) {
    let tx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat(
            "; transaction(price: UFix64, ts: UFix64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!.pushPrice(price: price, timestamp: ts) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [price, timestamp]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun pushTestRange(_ high: UFix64, _ low: UFix64) {
    let tx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat(
            "; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!.pushRange(high: high, low: low) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [high, low]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun openTestPosition(
    _ amount: UFix64,
    _ targetPrice: UFix64,
    _ aboveTarget: Bool,
    _ multiplier: UFix64,
    _ entryPrice: UFix64,
    _ durationBlocks: UInt64
): UInt64 {
    let tx = Test.Transaction(
        code: "import FungibleToken from ".concat(FT_ADDR).concat("; import MockPYUSD from ").concat(ADDR).concat("; import PredictionGame from ").concat(ADDR).concat(
            "; transaction(amount: UFix64, targetPrice: UFix64, aboveTarget: Bool, multiplier: UFix64, entryPrice: UFix64, durationBlocks: UInt64, expiryTimestamp: UFix64) { let userVault: @MockPYUSD.Vault; let adminRef: &PredictionGame.Admin; let userAddr: Address; prepare(userAcct: auth(BorrowValue) &Account, adminAcct: auth(BorrowValue) &Account) { let v = userAcct.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; self.userVault <- v.withdraw(amount: amount) as! @MockPYUSD.Vault; self.userAddr = userAcct.address; self.adminRef = adminAcct.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)! } execute { self.adminRef.openPosition(userVault: <-self.userVault, owner: self.userAddr, targetPrice: targetPrice, aboveTarget: aboveTarget, multiplier: multiplier, entryPrice: entryPrice, durationBlocks: durationBlocks, expiryTimestamp: expiryTimestamp) } }"
        ),
        authorizers: [user.address, admin.address],
        signers: [user, admin],
        arguments: [amount, targetPrice, aboveTarget, multiplier, entryPrice, durationBlocks, 1711700050.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())

    let r = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat(
            "; access(all) fun main(): UInt64 { return PredictionGame.getPositionCount() }"
        ), []
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! UInt64
}

access(all)
fun settleTestPosition(_ positionId: UInt64) {
    let tx = Test.Transaction(
        code: "import PredictionGame from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)!.settlePosition(positionId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [positionId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun settleTestPositionExpectFail(_ positionId: UInt64) {
    let tx = Test.Transaction(
        code: "import PredictionGame from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&PredictionGame.Admin>(from: PredictionGame.AdminStoragePath)!.settlePosition(positionId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [positionId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}

access(all)
fun getPositionResult(_ positionId: UInt64): [UFix64] {
    let r = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat(
            "; access(all) fun main(id: UInt64): [UFix64] { let p = PredictionGame.getPosition(positionId: id)!; return [p.settled ? 1.0 : 0.0, (p.won ?? false) ? 1.0 : 0.0, p.payout ?? 0.0] }"
        ),
        [positionId]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! [UFix64]
}

access(all)
fun getUserPYUSDBalance(): UFix64 {
    let r = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat(
            "; access(all) fun main(addr: Address): UFix64 { return getAccount(addr).capabilities.borrow<&MockPYUSD.Vault>(MockPYUSD.VaultPublicPath)!.balance }"
        ),
        [user.address]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! UFix64
}

access(all)
fun getHouseTestBalance(): UFix64 {
    let r = Test.executeScript(
        "import PredictionGame from ".concat(ADDR).concat(
            "; access(all) fun main(): UFix64 { return PredictionGame.getHouseBalance() }"
        ), []
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! UFix64
}

// ── Settlement Tests ───────────────────────────────────────────────────

access(all)
fun testSettleWinAboveViaRange() {
    let balBefore = getUserPYUSDBalance()
    let houseBefore = getHouseTestBalance()

    // Keep oracle current
    pushTestPrice(96600.0, 1711700100.0)

    // Open: target=97000, above=true, mult=2x, stake=10, duration=3
    let posId = openTestPosition(10.0, 97000.0, true, 2.0, 96600.0, 3)

    // Range with high=97500 touches target=97000
    pushTestRange(97500.0, 96000.0)

    // Advance blocks past expiry
    pushTestPrice(96700.0, 1711700200.0)
    pushTestPrice(96700.0, 1711700300.0)

    // Settle
    settleTestPosition(posId)

    // Verify: won with payout = 10 * 2 = 20
    let result = getPositionResult(posId)
    Test.assertEqual(1.0, result[0])  // settled
    Test.assertEqual(1.0, result[1])  // won
    Test.assertEqual(20.0, result[2]) // payout

    // User: -10 stake +20 payout = +10 net
    Test.assertEqual(balBefore + 10.0, getUserPYUSDBalance())
    // House: +10 stake -20 payout = -10 net
    Test.assertEqual(houseBefore - 10.0, getHouseTestBalance())
}

access(all)
fun testSettleLoseAbove() {
    // Target=99000 is unreachable
    let posId = openTestPosition(10.0, 99000.0, true, 3.0, 96700.0, 3)

    // Range high=97000 doesn't reach 99000
    pushTestRange(97000.0, 96000.0)

    pushTestPrice(96800.0, 1711700400.0)
    pushTestPrice(96800.0, 1711700500.0)

    settleTestPosition(posId)

    let result = getPositionResult(posId)
    Test.assertEqual(1.0, result[0])  // settled
    Test.assertEqual(0.0, result[1])  // lost
    Test.assertEqual(0.0, result[2])  // no payout
}

access(all)
fun testSettleWinBelowViaRange() {
    // Target=96000, below bet: low must reach <= 96000
    let posId = openTestPosition(10.0, 96000.0, false, 2.0, 96800.0, 3)

    // Range low=95500 touches target=96000 for below bet
    pushTestRange(97000.0, 95500.0)

    pushTestPrice(96500.0, 1711700600.0)
    pushTestPrice(96500.0, 1711700700.0)

    settleTestPosition(posId)

    let result = getPositionResult(posId)
    Test.assertEqual(1.0, result[0])  // settled
    Test.assertEqual(1.0, result[1])  // won
    Test.assertEqual(20.0, result[2]) // payout = 10 * 2
}

access(all)
fun testSettleWinFallbackToClosePrice() {
    // No range data pushed — only close prices
    let posId = openTestPosition(10.0, 97000.0, true, 2.0, 96500.0, 3)

    // Close price 97200 >= target 97000 (no pushRange — tests fallback path)
    pushTestPrice(97200.0, 1711700800.0)

    pushTestPrice(96600.0, 1711700900.0)
    pushTestPrice(96600.0, 1711701000.0)

    settleTestPosition(posId)

    let result = getPositionResult(posId)
    Test.assertEqual(1.0, result[0])  // settled
    Test.assertEqual(1.0, result[1])  // won via close price fallback
    Test.assertEqual(20.0, result[2]) // payout
}

access(all)
fun testSettleRejectsAlreadySettled() {
    // Position 2 was settled in testSettleWinAboveViaRange — confirm and retry
    let result = getPositionResult(2)
    Test.assertEqual(1.0, result[0]) // already settled
    settleTestPositionExpectFail(2)
}

access(all)
fun testSettleRejectsNotExpired() {
    // Very long duration — won't be expired for a long time
    let posId = openTestPosition(5.0, 97000.0, true, 2.0, 96600.0, 1000)
    settleTestPositionExpectFail(posId)
}
