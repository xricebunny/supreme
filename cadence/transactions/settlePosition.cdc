import "PredictionGame"

/// Admin settles an expired position. Called by the settlement bot.
transaction(positionId: UInt64) {

    let admin: &PredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")
    }

    execute {
        self.admin.settlePosition(positionId: positionId)
    }
}
