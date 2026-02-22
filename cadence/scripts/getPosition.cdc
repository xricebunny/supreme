import "PredictionGame"

/// Get a single position by ID.
access(all) fun main(positionId: UInt64): PredictionGame.Position? {
    return PredictionGame.getPosition(positionId: positionId)
}
