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
    deployContract("MockPYUSD", "../contracts/MockPYUSD.cdc")

    // Setup user PYUSD vault
    let setupVault = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; import FungibleToken from ").concat(FT_ADDR).concat("; transaction { prepare(signer: auth(SaveValue, Capabilities) &Account) { let vault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>()); signer.storage.save(<-vault, to: MockPYUSD.VaultStoragePath); let cap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath); signer.capabilities.publish(cap, at: MockPYUSD.VaultPublicPath); let rcap = signer.capabilities.storage.issue<&MockPYUSD.Vault>(MockPYUSD.VaultStoragePath); signer.capabilities.publish(rcap, at: MockPYUSD.ReceiverPublicPath) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: []
    )
    Test.expect(Test.executeTransaction(setupVault), Test.beSucceeded())
}

// ── Mint Tests ──────────────────────────────────────────────────────────

access(all)
fun testMintAndCheckBalance() {
    let mintTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; transaction(amount: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let minted <- MockPYUSD.mint(amount: amount); let ref = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; ref.deposit(from: <-minted) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: [100.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(mintTx), Test.beSucceeded())

    let balanceResult = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat("; access(all) fun main(addr: Address): UFix64 { let ref = getAccount(addr).capabilities.borrow<&MockPYUSD.Vault>(MockPYUSD.VaultPublicPath) ?? panic(\"No vault\"); return ref.balance }"),
        [user.address]
    )
    Test.expect(balanceResult, Test.beSucceeded())
    let balance = balanceResult.returnValue! as! UFix64
    Test.assertEqual(100.0, balance)
}

access(all)
fun testMintUpdatesTotalSupply() {
    let supplyBefore = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat("; access(all) fun main(): UFix64 { return MockPYUSD.totalSupply }"),
        []
    )
    Test.expect(supplyBefore, Test.beSucceeded())
    let before = supplyBefore.returnValue! as! UFix64

    let mintTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; transaction(amount: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let minted <- MockPYUSD.mint(amount: amount); let ref = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; ref.deposit(from: <-minted) } }"),
        authorizers: [admin.address],
        signers: [admin],
        arguments: [50.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(mintTx), Test.beSucceeded())

    let supplyAfter = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat("; access(all) fun main(): UFix64 { return MockPYUSD.totalSupply }"),
        []
    )
    Test.expect(supplyAfter, Test.beSucceeded())
    let after = supplyAfter.returnValue! as! UFix64
    Test.assertEqual(before + 50.0, after)
}

access(all)
fun testWithdrawAndTransfer() {
    // Mint 200 more to user
    let mintTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; transaction(amount: UFix64) { prepare(signer: auth(BorrowValue) &Account) { let minted <- MockPYUSD.mint(amount: amount); let ref = signer.storage.borrow<&MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; ref.deposit(from: <-minted) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: [200.0 as UFix64]
    )
    Test.expect(Test.executeTransaction(mintTx), Test.beSucceeded())

    // Transfer 50 from user to admin
    let transferTx = Test.Transaction(
        code: "import MockPYUSD from ".concat(ADDR).concat("; import FungibleToken from ").concat(FT_ADDR).concat("; transaction(amount: UFix64, to: Address) { prepare(signer: auth(BorrowValue) &Account) { let vault = signer.storage.borrow<auth(FungibleToken.Withdraw) &MockPYUSD.Vault>(from: MockPYUSD.VaultStoragePath)!; let tokens <- vault.withdraw(amount: amount); let receiver = getAccount(to).capabilities.borrow<&{FungibleToken.Receiver}>(MockPYUSD.ReceiverPublicPath)!; receiver.deposit(from: <-tokens) } }"),
        authorizers: [user.address],
        signers: [user],
        arguments: [50.0 as UFix64, admin.address]
    )
    Test.expect(Test.executeTransaction(transferTx), Test.beSucceeded())

    let adminBalance = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat("; access(all) fun main(addr: Address): UFix64 { let ref = getAccount(addr).capabilities.borrow<&MockPYUSD.Vault>(MockPYUSD.VaultPublicPath) ?? panic(\"No vault\"); return ref.balance }"),
        [admin.address]
    )
    Test.expect(adminBalance, Test.beSucceeded())
    let bal = adminBalance.returnValue! as! UFix64
    Test.assert(bal >= 50.0)
}

access(all)
fun testStoragePaths() {
    let result = Test.executeScript(
        "import MockPYUSD from ".concat(ADDR).concat("; access(all) fun main(): Bool { return MockPYUSD.VaultStoragePath == /storage/mockPYUSDVault }"),
        []
    )
    Test.expect(result, Test.beSucceeded())
    Test.assertEqual(true, result.returnValue! as! Bool)
}
