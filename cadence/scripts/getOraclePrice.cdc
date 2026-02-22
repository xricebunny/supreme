import "PriceOracle"

/// Get the oracle price at a specific block height.
access(all) fun main(blockHeight: UInt64): PriceOracle.PriceData? {
    return PriceOracle.getPrice(blockHeight: blockHeight)
}
