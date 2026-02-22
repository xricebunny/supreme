import "PriceOracle"

/// Admin prunes old oracle entries to manage storage growth.
transaction(beforeBlock: UInt64) {

    let admin: &PriceOracle.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)
            ?? panic("Could not borrow PriceOracle Admin")
    }

    execute {
        self.admin.pruneBeforeBlock(beforeBlock: beforeBlock)
    }
}
