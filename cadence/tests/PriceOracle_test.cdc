import Test

access(all) let admin = Test.getAccount(0x0000000000000007)
access(all) let ADDR = "0x0000000000000007"

access(all)
fun deployContract(_ name: String, _ path: String) {
    let code = Test.readFile(path)
    let deployTx = Test.Transaction(
        code: "transaction(name: String, code: String) { prepare(signer: auth(Contracts) &Account) { signer.contracts.add(name: name, code: code.utf8) } }",
        authorizers: [admin.address],
        signers: [admin],
        arguments: [name, code]
    )
    Test.expect(Test.executeTransaction(deployTx), Test.beSucceeded())
}

access(all)
fun setup() {
    deployContract("PriceOracle", "../contracts/PriceOracle.cdc")
}

// ── Initial State ───────────────────────────────────────────────────────

access(all)
fun testInitialStateIsEmpty() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PriceOracle.entryCount }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(0 as UInt64, result.returnValue! as! UInt64)
}

access(all)
fun testInitialLatestBlockIsZero() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PriceOracle.latestBlock }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(0 as UInt64, result.returnValue! as! UInt64)
}

access(all)
fun testInitialMaxChangeBps() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PriceOracle.maxChangeBps }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(5000 as UInt64, result.returnValue! as! UInt64)
}

access(all)
fun testGetLatestPriceReturnsNilWhenEmpty() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): Bool { return PriceOracle.getLatestPrice() == nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}

// ── Push Price ──────────────────────────────────────────────────────────

access(all)
fun testPushPrice() {
    let pushTx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(price: UFix64, ts: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.pushPrice(price: price, timestamp: ts) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [96500.0 as UFix64, 1711700000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beSucceeded())

    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PriceOracle.entryCount }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assert((result.returnValue! as! UInt64) > 0 as UInt64)
}

access(all)
fun testGetLatestPriceAfterPush() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UFix64? { if let p = PriceOracle.getLatestPrice() { return p.price }; return nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    let val = result.returnValue! as! UFix64?
    Test.assert(val != nil)
    Test.assertEqual(96500.0, val!)
}

// ── Read Functions ──────────────────────────────────────────────────────

access(all)
fun testGetPriceForNonexistentBlock() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): Bool { return PriceOracle.getPrice(blockHeight: 999999999) == nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}

access(all)
fun testGetPricesInRangeReturnsEmptyForNoData() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): Int { return PriceOracle.getPricesInRange(startBlock: 999999990, endBlock: 999999999).length }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(0, result.returnValue! as! Int)
}

access(all)
fun testGetClosestPriceReturnsNilForNoData() {
    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): Bool { return PriceOracle.getClosestPrice(targetBlock: 999999999, maxLookback: 10) == nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}

// ── Admin Config ────────────────────────────────────────────────────────

access(all)
fun testSetMaxChangeBps() {
    let setTx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(bps: UInt64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.setMaxChangeBps(bps: bps) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [8000 as UInt64]
    )
    Test.expect(Test.executeTransaction(setTx), Test.beSucceeded())

    let result = Test.executeScript(
        "import PriceOracle from ".concat(ADDR).concat("; access(all) fun main(): UInt64 { return PriceOracle.maxChangeBps }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(8000 as UInt64, result.returnValue! as! UInt64)
}

access(all)
fun testSetMaxChangeBpsRejectsTooLow() {
    let setTx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(bps: UInt64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.setMaxChangeBps(bps: bps) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [5 as UInt64]
    )
    Test.expect(Test.executeTransaction(setTx), Test.beFailed())
}

access(all)
fun testSetMaxChangeBpsRejectsTooHigh() {
    let setTx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(bps: UInt64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.setMaxChangeBps(bps: bps) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [20000 as UInt64]
    )
    Test.expect(Test.executeTransaction(setTx), Test.beFailed())
}

// ── Non-Admin Cannot Push ───────────────────────────────────────────────

access(all)
fun testNonAdminCannotPushPrice() {
    let nonAdmin = Test.createAccount()
    let pushTx = Test.Transaction(
        code: "import PriceOracle from ".concat(ADDR).concat("; transaction(price: UFix64, ts: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)!; a.pushPrice(price: price, timestamp: ts) } }"),
        authorizers: [nonAdmin.address],
        signers: [nonAdmin],
        arguments: [96500.0 as UFix64, 1711700000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beFailed())
}
