import "FlowPredictionGame"

/// Get the Flow house vault balance.
access(all) fun main(): UFix64 {
    return FlowPredictionGame.getHouseBalance()
}
