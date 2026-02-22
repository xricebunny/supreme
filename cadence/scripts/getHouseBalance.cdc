import "PredictionGame"

/// Get the house vault balance.
access(all) fun main(): UFix64 {
    return PredictionGame.getHouseBalance()
}
