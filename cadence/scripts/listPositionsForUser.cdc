import "PredictionGame"

/// Get all positions for a user address.
access(all) fun main(address: Address): [PredictionGame.Position] {
    return PredictionGame.listUserPositions(address: address)
}
