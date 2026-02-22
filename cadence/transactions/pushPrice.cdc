import "PriceOracle"

/// Admin pushes a new price to the oracle. Called by the backend oracle updater.
transaction(price: UFix64, timestamp: UFix64) {

    let admin: &PriceOracle.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PriceOracle.Admin>(from: PriceOracle.AdminStoragePath)
            ?? panic("Could not borrow PriceOracle Admin")
    }

    execute {
        self.admin.pushPrice(price: price, timestamp: timestamp)
    }
}
