/// PriceRangeOracle — companion to PriceOracle that stores high/low ranges per push interval.
/// Each push records the highest and lowest prices seen between oracle pushes.
/// Settlement uses these ranges for accurate "touch" detection — a target price
/// might have been briefly hit between pushes even if the close price didn't reach it.
access(all) contract PriceRangeOracle {

    // ── Events ─────────────────────────────────────────────────────────────

    access(all) event RangePushed(blockHeight: UInt64, high: UFix64, low: UFix64)

    // ── Range data ─────────────────────────────────────────────────────────

    access(all) struct PriceRange {
        access(all) let high: UFix64
        access(all) let low: UFix64

        init(high: UFix64, low: UFix64) {
            self.high = high
            self.low = low
        }
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// Block height → high/low range for that push interval.
    access(contract) var ranges: {UInt64: PriceRange}

    /// Admin resource storage path.
    access(all) let AdminStoragePath: StoragePath

    // ── Admin resource ─────────────────────────────────────────────────────

    access(all) resource Admin {

        /// Push a high/low range at the current block height.
        access(all) fun pushRange(high: UFix64, low: UFix64) {
            pre {
                high > 0.0: "High must be positive"
                low > 0.0: "Low must be positive"
                high >= low: "High must be >= low"
            }

            let blockHeight = getCurrentBlock().height
            let range = PriceRange(high: high, low: low)
            PriceRangeOracle.ranges[blockHeight] = range

            emit RangePushed(blockHeight: blockHeight, high: high, low: low)
        }

        /// Remove all entries with block height < beforeBlock.
        access(all) fun pruneBeforeBlock(beforeBlock: UInt64) {
            let keys = PriceRangeOracle.ranges.keys
            for key in keys {
                if key < beforeBlock {
                    PriceRangeOracle.ranges.remove(key: key)
                }
            }
        }
    }

    // ── Public read functions ──────────────────────────────────────────────

    /// Get the range at a specific block height.
    access(all) view fun getRange(blockHeight: UInt64): PriceRange? {
        return self.ranges[blockHeight]
    }

    /// Get all ranges in a block range [startBlock, endBlock] inclusive.
    access(all) fun getRangesInRange(startBlock: UInt64, endBlock: UInt64): [PriceRange] {
        var result: [PriceRange] = []
        let keys = self.ranges.keys
        for key in keys {
            if key >= startBlock && key <= endBlock {
                result.append(self.ranges[key]!)
            }
        }
        return result
    }

    // ── Init ───────────────────────────────────────────────────────────────

    init() {
        self.ranges = {}
        self.AdminStoragePath = /storage/priceRangeOracleAdmin

        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)
    }
}
