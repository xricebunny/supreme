import "PriceOracle"

/// Get the latest oracle price and staleness info.
access(all) fun main(): {String: AnyStruct} {
    let currentBlock = getCurrentBlock().height

    let latest = PriceOracle.getLatestPrice()
    if latest == nil {
        return {
            "price": 0.0 as UFix64,
            "updatedAtBlock": 0 as UInt64,
            "currentBlock": currentBlock,
            "blocksSinceUpdate": currentBlock,
            "isStale": true,
            "entryCount": PriceOracle.getEntryCount()
        }
    }

    let latestBlock = PriceOracle.latestBlock
    let blocksSinceUpdate = currentBlock - latestBlock

    return {
        "price": latest!.price,
        "timestamp": latest!.timestamp,
        "updatedAtBlock": latestBlock,
        "currentBlock": currentBlock,
        "blocksSinceUpdate": blocksSinceUpdate,
        "isStale": blocksSinceUpdate > 50,
        "entryCount": PriceOracle.getEntryCount()
    }
}
