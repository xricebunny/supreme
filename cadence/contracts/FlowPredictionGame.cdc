import "FungibleToken"
import "MockPYUSD"
import "FlowPriceOracle"
import "FlowPriceRangeOracle"

/// FlowPredictionGame — grid-based FLOW price prediction game.
/// Users bet that FLOW will "touch" a target price before expiry.
/// Multi-auth: user provides PYUSD, admin co-signs to attest oracle price.
/// Settlement iterates oracle price history to check if the target was touched.
access(all) contract FlowPredictionGame {

    // ── Events ─────────────────────────────────────────────────────────────

    access(all) event ContractInitialized()
    access(all) event HouseFunded(amount: UFix64)
    access(all) event PositionOpened(
        positionId: UInt64,
        owner: Address,
        stake: UFix64,
        entryPrice: UFix64,
        targetPrice: UFix64,
        aboveTarget: Bool,
        multiplier: UFix64,
        entryBlock: UInt64,
        expiryBlock: UInt64,
        expiryTimestamp: UFix64
    )
    access(all) event PositionSettled(
        positionId: UInt64,
        owner: Address,
        won: Bool,
        stake: UFix64,
        payout: UFix64,
        multiplier: UFix64,
        entryPrice: UFix64,
        targetPrice: UFix64,
        aboveTarget: Bool,
        touchedPrice: UFix64?,
        touchedAtBlock: UInt64?,
        oraclePriceCount: Int,
        entryBlock: UInt64,
        expiryBlock: UInt64
    )
    access(all) event PositionCanceled(positionId: UInt64, refund: UFix64)

    // ── Configuration ──────────────────────────────────────────────────────

    /// Blocks after expiry before emergency cancel is allowed (~8 min).
    access(all) let emergencyTimeoutBlocks: UInt64

    /// Maximum allowed multiplier.
    access(all) let maxMultiplier: UFix64

    /// Minimum allowed multiplier.
    access(all) let minMultiplier: UFix64

    /// Storage paths.
    access(all) let AdminStoragePath: StoragePath

    // ── Position ───────────────────────────────────────────────────────────

    access(all) struct Position {
        access(all) let id: UInt64
        access(all) let owner: Address
        access(all) let stake: UFix64
        access(all) let entryPrice: UFix64
        access(all) let targetPrice: UFix64
        access(all) let aboveTarget: Bool
        access(all) let multiplier: UFix64
        access(all) let entryBlock: UInt64
        access(all) let expiryBlock: UInt64
        access(all) let expiryTimestamp: UFix64
        access(all) var settled: Bool
        access(all) var won: Bool?
        access(all) var touchedAtBlock: UInt64?
        access(all) var touchedPrice: UFix64?
        access(all) var payout: UFix64?

        init(
            id: UInt64,
            owner: Address,
            stake: UFix64,
            entryPrice: UFix64,
            targetPrice: UFix64,
            aboveTarget: Bool,
            multiplier: UFix64,
            entryBlock: UInt64,
            expiryBlock: UInt64,
            expiryTimestamp: UFix64
        ) {
            self.id = id
            self.owner = owner
            self.stake = stake
            self.entryPrice = entryPrice
            self.targetPrice = targetPrice
            self.aboveTarget = aboveTarget
            self.multiplier = multiplier
            self.entryBlock = entryBlock
            self.expiryBlock = expiryBlock
            self.expiryTimestamp = expiryTimestamp
            self.settled = false
            self.won = nil
            self.touchedAtBlock = nil
            self.touchedPrice = nil
            self.payout = nil
        }

        access(contract) fun settle(won: Bool, payout: UFix64, touchedAtBlock: UInt64?, touchedPrice: UFix64?) {
            self.settled = true
            self.won = won
            self.payout = payout
            self.touchedAtBlock = touchedAtBlock
            self.touchedPrice = touchedPrice
        }
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// House vault holding all escrowed stakes and payout funds.
    access(contract) var houseVault: @MockPYUSD.Vault

    /// All positions by ID.
    access(contract) var positions: {UInt64: Position}

    /// Positions by owner for user lookups.
    access(contract) var positionsByUser: {Address: [UInt64]}

    /// Auto-incrementing position ID counter.
    access(contract) var positionCounter: UInt64

    // ── Admin resource ─────────────────────────────────────────────────────

    access(all) resource Admin {

        /// Open a position on behalf of a user. Called in a multi-auth transaction
        /// where the user provides the PYUSD vault and the admin co-signs.
        access(all) fun openPosition(
            userVault: @MockPYUSD.Vault,
            owner: Address,
            targetPrice: UFix64,
            aboveTarget: Bool,
            multiplier: UFix64,
            entryPrice: UFix64,
            durationBlocks: UInt64,
            expiryTimestamp: UFix64
        ): UInt64 {
            pre {
                userVault.balance > 0.0: "Stake must be positive"
                multiplier >= FlowPredictionGame.minMultiplier: "Multiplier below minimum"
                multiplier <= FlowPredictionGame.maxMultiplier: "Multiplier above maximum"
                durationBlocks > 0: "Duration must be positive"
                targetPrice > 0.0: "Target price must be positive"
                entryPrice > 0.0: "Entry price must be positive"
            }

            let stake = userVault.balance

            // Check house can cover potential payout
            let potentialPayout = stake * multiplier
            assert(
                FlowPredictionGame.houseVault.balance >= potentialPayout,
                message: "House cannot cover potential payout"
            )

            let currentBlock = getCurrentBlock().height
            let expiryBlock = currentBlock + durationBlocks

            // Generate position ID
            FlowPredictionGame.positionCounter = FlowPredictionGame.positionCounter + 1
            let positionId = FlowPredictionGame.positionCounter

            let position = Position(
                id: positionId,
                owner: owner,
                stake: stake,
                entryPrice: entryPrice,
                targetPrice: targetPrice,
                aboveTarget: aboveTarget,
                multiplier: multiplier,
                entryBlock: currentBlock,
                expiryBlock: expiryBlock,
                expiryTimestamp: expiryTimestamp
            )

            // Store position
            FlowPredictionGame.positions[positionId] = position

            // Track by owner
            if FlowPredictionGame.positionsByUser[owner] == nil {
                FlowPredictionGame.positionsByUser[owner] = []
            }
            FlowPredictionGame.positionsByUser[owner]!.append(positionId)

            // Escrow stake into house vault
            FlowPredictionGame.houseVault.deposit(from: <-userVault)

            emit PositionOpened(
                positionId: positionId,
                owner: owner,
                stake: stake,
                entryPrice: entryPrice,
                targetPrice: targetPrice,
                aboveTarget: aboveTarget,
                multiplier: multiplier,
                entryBlock: currentBlock,
                expiryBlock: expiryBlock,
                expiryTimestamp: expiryTimestamp
            )

            return positionId
        }

        /// Settle an expired position by checking oracle price history for a "touch".
        access(all) fun settlePosition(positionId: UInt64) {
            let currentBlock = getCurrentBlock().height

            let position = FlowPredictionGame.positions[positionId]
                ?? panic("Position not found")

            assert(!position.settled, message: "Position already settled")
            assert(currentBlock >= position.expiryBlock, message: "Position not yet expired")

            // Get all oracle price ranges during the position's lifetime.
            let ranges = FlowPriceRangeOracle.getRangesInRange(
                startBlock: position.entryBlock,
                endBlock: position.expiryBlock
            )
            let prices = FlowPriceOracle.getPricesInRange(
                startBlock: position.entryBlock,
                endBlock: position.expiryBlock
            )

            // Check if any price range "touched" the target.
            var touched = false
            var touchBlock: UInt64? = nil
            var touchPrice: UFix64? = nil

            // First check ranges (high/low data — more accurate)
            for rangeData in ranges {
                if position.aboveTarget {
                    if rangeData.high >= position.targetPrice {
                        touched = true
                        touchPrice = rangeData.high
                        break
                    }
                } else {
                    if rangeData.low <= position.targetPrice {
                        touched = true
                        touchPrice = rangeData.low
                        break
                    }
                }
            }

            // Fallback: check close prices for legacy entries without range data
            if !touched {
                for priceData in prices {
                    if position.aboveTarget {
                        if priceData.price >= position.targetPrice {
                            touched = true
                            touchPrice = priceData.price
                            break
                        }
                    } else {
                        if priceData.price <= position.targetPrice {
                            touched = true
                            touchPrice = priceData.price
                            break
                        }
                    }
                }
            }

            var payout: UFix64 = 0.0
            if touched {
                payout = position.stake * position.multiplier
            }

            // Update position
            position.settle(
                won: touched,
                payout: payout,
                touchedAtBlock: touchBlock,
                touchedPrice: touchPrice
            )
            FlowPredictionGame.positions[positionId] = position

            emit PositionSettled(
                positionId: positionId,
                owner: position.owner,
                won: touched,
                stake: position.stake,
                payout: payout,
                multiplier: position.multiplier,
                entryPrice: position.entryPrice,
                targetPrice: position.targetPrice,
                aboveTarget: position.aboveTarget,
                touchedPrice: touchPrice,
                touchedAtBlock: touchBlock,
                oraclePriceCount: ranges.length + prices.length,
                entryBlock: position.entryBlock,
                expiryBlock: position.expiryBlock
            )

            // Transfer payout to winner
            if payout > 0.0 {
                let payoutVault <- FlowPredictionGame.houseVault.withdraw(amount: payout)
                let receiverRef = getAccount(position.owner)
                    .capabilities.get<&{FungibleToken.Receiver}>(MockPYUSD.ReceiverPublicPath)
                    .borrow()
                    ?? panic("Could not borrow receiver for position owner")
                receiverRef.deposit(from: <-payoutVault)
            }
        }

        /// Fund the house vault.
        access(all) fun fundHouse(from: @MockPYUSD.Vault) {
            let amount = from.balance
            FlowPredictionGame.houseVault.deposit(from: <-from)
            emit HouseFunded(amount: amount)
        }
    }

    // ── Public functions (no admin required) ────────────────────────────────

    /// Emergency cancel: anyone can call after the emergency timeout.
    /// Returns the full stake to the position owner.
    access(all) fun cancelPosition(positionId: UInt64) {
        let currentBlock = getCurrentBlock().height

        let position = self.positions[positionId]
            ?? panic("Position not found")

        assert(!position.settled, message: "Position already settled")

        let emergencyThreshold = position.expiryBlock + self.emergencyTimeoutBlocks
        assert(
            currentBlock >= emergencyThreshold,
            message: "Emergency cancel not yet available (need block "
                .concat(emergencyThreshold.toString())
                .concat(", current ")
                .concat(currentBlock.toString())
                .concat(")")
        )

        // Settle as refund
        position.settle(won: false, payout: position.stake, touchedAtBlock: nil, touchedPrice: nil)
        self.positions[positionId] = position

        emit PositionCanceled(positionId: positionId, refund: position.stake)

        // Return stake to owner
        let refundVault <- self.houseVault.withdraw(amount: position.stake)
        let receiverRef = getAccount(position.owner)
            .capabilities.get<&{FungibleToken.Receiver}>(MockPYUSD.ReceiverPublicPath)
            .borrow()
            ?? panic("Could not borrow receiver for position owner")
        receiverRef.deposit(from: <-refundVault)
    }

    // ── View functions ─────────────────────────────────────────────────────

    access(all) view fun getPosition(positionId: UInt64): Position? {
        return self.positions[positionId]
    }

    access(all) fun listUserPositions(address: Address): [Position] {
        let ids = self.positionsByUser[address] ?? []
        var userPositions: [Position] = []
        for id in ids {
            if let pos = self.positions[id] {
                userPositions.append(pos)
            }
        }
        return userPositions
    }

    access(all) view fun getHouseBalance(): UFix64 {
        return self.houseVault.balance
    }

    access(all) view fun getPositionCount(): UInt64 {
        return self.positionCounter
    }

    // ── Init ───────────────────────────────────────────────────────────────

    init() {
        self.emergencyTimeoutBlocks = 400    // ~8 minutes on Flow
        self.maxMultiplier = 100.0
        self.minMultiplier = 1.0
        self.AdminStoragePath = /storage/flowPredictionGameAdmin

        self.houseVault <- MockPYUSD.createEmptyVault(vaultType: Type<@MockPYUSD.Vault>()) as! @MockPYUSD.Vault
        self.positions = {}
        self.positionsByUser = {}
        self.positionCounter = 0

        // Create and store admin resource
        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)

        emit ContractInitialized()
    }
}
