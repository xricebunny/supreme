import "FlowPredictionGame"

/// Returns all Flow positions that are past their expiry block and not yet settled.
/// Used by the settlement bot to find positions that need settlement.
access(all) fun main(): [FlowPredictionGame.Position] {
    let currentBlock = getCurrentBlock().height
    let totalPositions = FlowPredictionGame.getPositionCount()
    var expired: [FlowPredictionGame.Position] = []

    var id: UInt64 = 1
    while id <= totalPositions {
        if let position = FlowPredictionGame.getPosition(positionId: id) {
            if !position.settled && currentBlock >= position.expiryBlock {
                expired.append(position)
            }
        }
        id = id + 1
    }

    return expired
}
