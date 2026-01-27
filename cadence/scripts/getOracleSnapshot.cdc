// getOracleSnapshot.cdc
// Get latest oracle price and staleness info

// import PublicPriceOracle from 0xORACLE_ADDRESS

pub fun main(): {String: AnyStruct} {
    let currentBlock = getCurrentBlock().height
    
    // TODO: Replace with actual PublicPriceOracle calls
    // let price = PublicPriceOracle.getLatestPrice()
    // let updatedAtBlock = PublicPriceOracle.getLatestBlockHeight()
    
    // Mock data for hackathon testing
    let price: UFix64 = 100.50
    let updatedAtBlock: UInt64 = currentBlock - 10
    
    // Calculate staleness (max 50 blocks for entry)
    let blocksSinceUpdate = currentBlock - updatedAtBlock
    let isStale = blocksSinceUpdate > 50
    
    return {
        "price": price,
        "updatedAtBlock": updatedAtBlock,
        "currentBlock": currentBlock,
        "blocksSinceUpdate": blocksSinceUpdate,
        "isStale": isStale
    }
}
