import "PriceOracle"

/// Get the latest oracle price.
access(all) fun main(): PriceOracle.PriceData? {
    return PriceOracle.getLatestPrice()
}
