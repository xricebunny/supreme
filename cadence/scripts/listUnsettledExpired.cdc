import "PredictionGame"

/// Returns all positions that are past their expiry block and not yet settled.
/// Used by the settlement bot to find positions that need settlement.
access(all) fun main(): [PredictionGame.Position] {
    let currentBlock = getCurrentBlock().height
    let totalPositions = PredictionGame.getPositionCount()
    var expired: [PredictionGame.Position] = []

    var id: UInt64 = 1
    while id <= totalPositions {
        if let position = PredictionGame.getPosition(positionId: id) {
            if !position.settled && currentBlock >= position.expiryBlock {
                expired.append(position)
            }
        }
        id = id + 1
    }

    return expired
}
