import "PredictionGame"

/// Emergency cancel after timeout. Anyone can call.
/// Returns full stake to position owner.
transaction(positionId: UInt64) {

    prepare(signer: auth(BorrowValue) &Account) {
        // No special permissions needed — cancelPosition is public
    }

    execute {
        PredictionGame.cancelPosition(positionId: positionId)
    }
}
