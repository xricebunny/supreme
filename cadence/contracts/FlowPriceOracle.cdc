/// FlowPriceOracle — stores a rolling history of FLOW/USDT prices indexed by block height.
/// Only the admin can push prices. Anyone can read.
/// Settlement uses getPricesInRange() to check the "touch" win condition.
access(all) contract FlowPriceOracle {

    // ── Events ─────────────────────────────────────────────────────────────

    access(all) event PricePushed(blockHeight: UInt64, price: UFix64, timestamp: UFix64)
    access(all) event PricesPruned(beforeBlock: UInt64, removedCount: UInt64)

    // ── Price data ─────────────────────────────────────────────────────────

    access(all) struct PriceData {
        access(all) let price: UFix64
        access(all) let timestamp: UFix64   // UNIX seconds from Binance

        init(price: UFix64, timestamp: UFix64) {
            self.price = price
            self.timestamp = timestamp
        }
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// Block height → price data. No hard size cap — pruned operationally.
    access(contract) var priceHistory: {UInt64: PriceData}

    /// The most recent block height with a price entry.
    access(all) var latestBlock: UInt64

    /// Total entries currently stored.
    access(all) var entryCount: UInt64

    /// Maximum allowed percentage change per push (basis points, 5000 = 50%).
    access(all) var maxChangeBps: UInt64

    /// Admin resource storage path.
    access(all) let AdminStoragePath: StoragePath

    // ── Admin resource ─────────────────────────────────────────────────────

    access(all) resource Admin {

        /// Push a new price at the current block height.
        access(all) fun pushPrice(price: UFix64, timestamp: UFix64) {
            pre {
                price > 0.0: "Price must be positive"
            }

            let blockHeight = getCurrentBlock().height

            // Manipulation guard: reject change > maxChangeBps from last price (skip on first push)
            if FlowPriceOracle.latestBlock > 0 {
                if let lastEntry = FlowPriceOracle.priceHistory[FlowPriceOracle.latestBlock] {
                    let lastPrice = lastEntry.price
                    let maxChange = lastPrice * UFix64(FlowPriceOracle.maxChangeBps) / 10000.0
                    let diff = price > lastPrice ? (price - lastPrice) : (lastPrice - price)
                    assert(
                        diff <= maxChange,
                        message: "Price change exceeds maximum allowed (".concat(diff.toString()).concat(" > ").concat(maxChange.toString()).concat(")")
                    )
                }
            }

            let entry = PriceData(price: price, timestamp: timestamp)
            FlowPriceOracle.priceHistory[blockHeight] = entry
            FlowPriceOracle.latestBlock = blockHeight
            FlowPriceOracle.entryCount = FlowPriceOracle.entryCount + 1

            emit PricePushed(blockHeight: blockHeight, price: price, timestamp: timestamp)
        }

        /// Update the max allowed price change per push (in basis points).
        access(all) fun setMaxChangeBps(bps: UInt64) {
            pre {
                bps >= 10: "maxChangeBps must be at least 10 (0.1%)"
                bps <= 10000: "maxChangeBps cannot exceed 10000 (100%)"
            }
            FlowPriceOracle.maxChangeBps = bps
        }

        /// Remove all entries with block height < beforeBlock.
        /// Call periodically to manage storage growth.
        access(all) fun pruneBeforeBlock(beforeBlock: UInt64) {
            var removedCount: UInt64 = 0
            let keys = FlowPriceOracle.priceHistory.keys
            for key in keys {
                if key < beforeBlock {
                    FlowPriceOracle.priceHistory.remove(key: key)
                    removedCount = removedCount + 1
                }
            }
            FlowPriceOracle.entryCount = FlowPriceOracle.entryCount - removedCount
            emit PricesPruned(beforeBlock: beforeBlock, removedCount: removedCount)
        }
    }

    // ── Public read functions ──────────────────────────────────────────────

    /// Get price at a specific block height. Returns nil if no entry exists.
    access(all) view fun getPrice(blockHeight: UInt64): PriceData? {
        return self.priceHistory[blockHeight]
    }

    /// Get the latest stored price.
    access(all) view fun getLatestPrice(): PriceData? {
        if self.latestBlock == 0 {
            return nil
        }
        return self.priceHistory[self.latestBlock]
    }

    /// Get all stored prices in a block range [startBlock, endBlock] inclusive.
    /// Used by settlement to check the "touch" win condition.
    access(all) fun getPricesInRange(startBlock: UInt64, endBlock: UInt64): [PriceData] {
        var prices: [PriceData] = []
        let keys = self.priceHistory.keys
        for key in keys {
            if key >= startBlock && key <= endBlock {
                prices.append(self.priceHistory[key]!)
            }
        }
        return prices
    }

    /// Get the closest price at or before a target block.
    /// Searches backwards up to maxLookback blocks.
    access(all) view fun getClosestPrice(targetBlock: UInt64, maxLookback: UInt64): PriceData? {
        var block = targetBlock
        let minBlock: UInt64 = targetBlock > maxLookback ? (targetBlock - maxLookback) : 0
        while block >= minBlock {
            if let entry = self.priceHistory[block] {
                return entry
            }
            if block == 0 { break }
            block = block - 1
        }
        return nil
    }

    /// Get the current number of stored entries.
    access(all) view fun getEntryCount(): UInt64 {
        return self.entryCount
    }

    // ── Init ───────────────────────────────────────────────────────────────

    init() {
        self.priceHistory = {}
        self.latestBlock = 0
        self.entryCount = 0
        self.maxChangeBps = 5000  // 50%
        self.AdminStoragePath = /storage/flowPriceOracleAdmin

        // Create and store the admin resource
        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)
    }
}
