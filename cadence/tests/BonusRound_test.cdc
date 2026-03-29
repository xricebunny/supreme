import Test
import BlockchainHelpers

access(all) let admin = Test.getAccount(0x0000000000000007)
access(all) let player1 = Test.createAccount()
access(all) let player2 = Test.createAccount()
access(all) let ADDR = "0x0000000000000007"

access(all)
fun setup() {
    // Deploy Xorshift128plus first (no dependencies beyond Crypto built-in)
    var err = Test.deployContract(
        name: "Xorshift128plus",
        path: "../contracts/Xorshift128plus.cdc",
        arguments: []
    )
    Test.expect(err, Test.beNil())

    // Deploy RandomConsumer (depends on Xorshift128plus, RandomBeaconHistory, Burner)
    err = Test.deployContract(
        name: "RandomConsumer",
        path: "../contracts/RandomConsumer.cdc",
        arguments: []
    )
    Test.expect(err, Test.beNil())

    // Deploy BonusRound (depends on RandomConsumer)
    err = Test.deployContract(
        name: "BonusRound",
        path: "../contracts/BonusRound.cdc",
        arguments: []
    )
    Test.expect(err, Test.beNil())
}

// ── Helpers ────────────────────────────────────────────────────────────

access(all)
fun recordWin(_ player: Address) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(player: Address) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.recordWin(player: player) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [player]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun recordLoss(_ player: Address) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(player: Address) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.recordLoss(player: player) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [player]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun requestBonus(_ playerAddress: Address) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(player: Address) { prepare(signer: auth(BorrowValue) &Account) {} execute { BonusRound.requestBonusRound(player: player) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [playerAddress]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun requestBonusExpectFail(_ playerAddress: Address) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(player: Address) { prepare(signer: auth(BorrowValue) &Account) {} execute { BonusRound.requestBonusRound(player: player) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [playerAddress]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}

access(all)
fun revealBonus(_ requestId: UInt64) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.revealBonusRound(requestId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [requestId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun revealBonusExpectFail(_ requestId: UInt64) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.revealBonusRound(requestId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [requestId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}

access(all)
fun redeemBonus(_ requestId: UInt64) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.redeemBonus(requestId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [requestId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
}

access(all)
fun redeemBonusExpectFail(_ requestId: UInt64) {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.redeemBonus(requestId: id) } }"
        ),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [requestId]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}

access(all)
fun getStreak(_ player: Address): UInt64 {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(addr: Address): UInt64 { return BonusRound.getStreak(player: addr) }"
        ),
        [player]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! UInt64
}

access(all)
fun getRequestMultiplier(_ requestId: UInt64): UFix64 {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(id: UInt64): UFix64 { return BonusRound.getRequest(requestId: id)!.multiplierBoost! }"
        ),
        [requestId]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! UFix64
}

access(all)
fun getRequestRevealed(_ requestId: UInt64): Bool {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(id: UInt64): Bool { return BonusRound.getRequest(requestId: id)!.revealed }"
        ),
        [requestId]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! Bool
}

access(all)
fun getRequestRedeemed(_ requestId: UInt64): Bool {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(id: UInt64): Bool { return BonusRound.getRequest(requestId: id)!.redeemed }"
        ),
        [requestId]
    )
    Test.expect(r, Test.beSucceeded())
    return r.returnValue! as! Bool
}

/// Advance the emulator by N blocks to ensure RandomBeaconHistory has
/// the source of randomness for the commit block.
access(all)
fun advanceBlocks(_ n: UInt64) {
    var i: UInt64 = 0
    while i < n {
        // Execute a no-op transaction to advance the block
        let tx = Test.Transaction(
            code: "transaction { prepare(signer: &Account) {} }",
            authorizers: [admin.address],
            signers: [admin],
            arguments: []
        )
        Test.expect(Test.executeTransaction(tx), Test.beSucceeded())
        i = i + 1
    }
}

// ── Configuration Tests ────────────────────────────────────────────────

access(all)
fun testInitialConfig() {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(): [UInt64] { return [BonusRound.streakThreshold] }"
        ), []
    )
    Test.expect(r, Test.beSucceeded())
    let vals = r.returnValue! as! [UInt64]
    Test.assertEqual(3 as UInt64, vals[0])
}

access(all)
fun testMultiplierTiers() {
    let r = Test.executeScript(
        "import BonusRound from ".concat(ADDR).concat(
            "; access(all) fun main(): [UFix64] { let t = BonusRound.multiplierTiers; return [t[0], t[1], t[2], t[3]] }"
        ), []
    )
    Test.expect(r, Test.beSucceeded())
    let tiers = r.returnValue! as! [UFix64]
    Test.assertEqual(4, tiers.length)
    Test.assertEqual(1.5, tiers[0])
    Test.assertEqual(2.0, tiers[1])
    Test.assertEqual(3.0, tiers[2])
    Test.assertEqual(5.0, tiers[3])
}

// ── Streak Tracking Tests ──────────────────────────────────────────────

access(all)
fun testRecordWinAndStreak() {
    recordWin(player1.address)
    Test.assertEqual(1 as UInt64, getStreak(player1.address))
}

access(all)
fun testStreakBuildsToThreshold() {
    recordWin(player1.address) // streak 2
    recordWin(player1.address) // streak 3
    Test.assertEqual(3 as UInt64, getStreak(player1.address))
}

access(all)
fun testLossResetsStreak() {
    recordLoss(player1.address)
    Test.assertEqual(0 as UInt64, getStreak(player1.address))
}

// ── Bonus Request Validation ───────────────────────────────────────────

access(all)
fun testRequestRejectsInsufficientStreak() {
    recordWin(player1.address) // streak 1
    recordWin(player1.address) // streak 2
    requestBonusExpectFail(player1.address)
}

// ── Full Bonus Flow: Commit → Reveal → Redeem ─────────────────────────

access(all)
fun testFullBonusFlow() {
    // Build to threshold (player1 has streak=2 from previous test)
    recordWin(player1.address) // streak 3

    // COMMIT phase: request bonus → creates RandomConsumer.Request pinned to current block
    requestBonus(player1.address)

    // Streak consumed
    Test.assertEqual(0 as UInt64, getStreak(player1.address))

    // Request exists and is not yet revealed
    Test.assertEqual(false, getRequestRevealed(1))

    // Advance blocks so RandomBeaconHistory has the source of randomness
    // for the commit block (must be at least 1 block later)
    advanceBlocks(2)

    // REVEAL phase: admin reveals using RandomBeaconHistory → Xorshift128plus PRG
    revealBonus(1)
    Test.assertEqual(true, getRequestRevealed(1))

    // Multiplier must be one of the valid tiers
    let boost = getRequestMultiplier(1)
    Test.assert(
        boost == 1.5 || boost == 2.0 || boost == 3.0 || boost == 5.0,
        message: "Multiplier ".concat(boost.toString()).concat(" is not a valid tier")
    )

    // REDEEM
    redeemBonus(1)
    Test.assertEqual(true, getRequestRedeemed(1))
}

// ── Anti-Stacking ──────────────────────────────────────────────────────

access(all)
fun testNoStackingBonusRequests() {
    // Build player2 streak to threshold
    recordWin(player2.address)
    recordWin(player2.address)
    recordWin(player2.address) // streak 3
    requestBonus(player2.address) // creates request 2

    // Build another streak immediately
    recordWin(player2.address)
    recordWin(player2.address)
    recordWin(player2.address) // streak 3

    // Can't request again while previous is active (unredeemed)
    requestBonusExpectFail(player2.address)
}

// ── Double-Action Guards ───────────────────────────────────────────────

access(all)
fun testRevealRejectsAlreadyRevealed() {
    // Request 1 was revealed in testFullBonusFlow
    revealBonusExpectFail(1)
}

access(all)
fun testRedeemRejectsAlreadyRedeemed() {
    // Request 1 was redeemed in testFullBonusFlow
    redeemBonusExpectFail(1)
}

access(all)
fun testRedeemRejectsUnrevealed() {
    // Request 2 from testNoStackingBonusRequests is not yet revealed
    redeemBonusExpectFail(2)
}

// ── Access Control ─────────────────────────────────────────────────────

access(all)
fun testNonAdminCannotRecordWin() {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(player: Address) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.recordWin(player: player) } }"
        ),
        authorizers: [player1.address],
        signers: [player1],
        arguments: [player1.address]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}

access(all)
fun testNonAdminCannotReveal() {
    let tx = Test.Transaction(
        code: "import BonusRound from ".concat(ADDR).concat(
            "; transaction(id: UInt64) { prepare(signer: auth(BorrowValue) &Account) { signer.storage.borrow<&BonusRound.Admin>(from: BonusRound.AdminStoragePath)!.revealBonusRound(requestId: id) } }"
        ),
        authorizers: [player1.address],
        signers: [player1],
        arguments: [2 as UInt64]
    )
    Test.expect(Test.executeTransaction(tx), Test.beFailed())
}
