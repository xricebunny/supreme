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
    deployContract("PriceRangeOracle", "../contracts/PriceRangeOracle.cdc")
}

// ── Push Range ──────────────────────────────────────────────────────────

access(all)
fun testPushRange() {
    let pushTx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat("; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!; a.pushRange(high: high, low: low) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [96600.0 as UFix64, 96400.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beSucceeded())
}

// ── Read ────────────────────────────────────────────────────────────────

access(all)
fun testGetRangeForNonexistentBlock() {
    let result = Test.executeScript(
        "import PriceRangeOracle from ".concat(ADDR).concat("; access(all) fun main(): Bool { return PriceRangeOracle.getRange(blockHeight: 999999999) == nil }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}

access(all)
fun testGetRangesInRangeReturnsEmptyForNoData() {
    let result = Test.executeScript(
        "import PriceRangeOracle from ".concat(ADDR).concat("; access(all) fun main(): Int { return PriceRangeOracle.getRangesInRange(startBlock: 999999990, endBlock: 999999999).length }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(0, result.returnValue! as! Int)
}

// ── Validation ──────────────────────────────────────────────────────────

access(all)
fun testPushRangeRejectsHighLessThanLow() {
    let pushTx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat("; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!; a.pushRange(high: high, low: low) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [96000.0 as UFix64, 97000.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beFailed())
}

access(all)
fun testPushRangeRejectsZeroHigh() {
    let pushTx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat("; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!; a.pushRange(high: high, low: low) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [0.0 as UFix64, 0.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beFailed())
}

// ── Non-Admin Cannot Push ───────────────────────────────────────────────

access(all)
fun testNonAdminCannotPushRange() {
    let nonAdmin = Test.createAccount()
    let pushTx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat("; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!; a.pushRange(high: high, low: low) } }"),
        authorizers: [nonAdmin.address],
        signers: [nonAdmin],
        arguments: [96600.0 as UFix64, 96400.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beFailed())
}

access(all)
fun testPushEqualHighAndLow() {
    let pushTx = Test.Transaction(
        code: "import PriceRangeOracle from ".concat(ADDR).concat("; transaction(high: UFix64, low: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let a = signer.storage.borrow<&PriceRangeOracle.Admin>(from: PriceRangeOracle.AdminStoragePath)!; a.pushRange(high: high, low: low) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [96500.0 as UFix64, 96500.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(pushTx), Test.beSucceeded())
}
