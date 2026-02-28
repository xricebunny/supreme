import "FlowPredictionGame"

/// Admin settles an expired Flow position. Called by the settlement bot.
transaction(positionId: UInt64) {

    let admin: &FlowPredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&FlowPredictionGame.Admin>(
            from: FlowPredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow FlowPredictionGame Admin")
    }

    execute {
        self.admin.settlePosition(positionId: positionId)
    }
}
