// MicroOptionsMVP.cdc
// Grid-based micro-options betting contract with oracle integration
// Hackathon MVP - simplified settlement logic

import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868

pub contract MicroOptionsMVP {

    // ============================================================================
    // Events
    // ============================================================================
    
    pub event ContractInitialized()
    pub event HouseFunded(amount: UFix64)
    pub event PositionOpened(
        positionId: String,
        owner: Address,
        stake: UFix64,
        row: Int,
        col: Int,
        multiplierTier: UFix64,
        entryPrice: UFix64,
        entryBlockHeight: UInt64,
        expiryBlockHeight: UInt64
    )
    pub event PositionSettled(
        positionId: String,
        won: Bool,
        payout: UFix64,
        exitPrice: UFix64
    )
    pub event PositionCanceled(positionId: String, refund: UFix64)

    // ============================================================================
    // Configuration
    // ============================================================================
    
    // Oracle staleness thresholds (in blocks)
    pub let maxStaleBlocksEntry: UInt64
    pub let maxStaleBlocksSettle: UInt64
    
    // Position duration (in blocks) - approximately 1-2 minutes on Flow
    pub let positionDurationBlocks: UInt64
    
    // Emergency cancel timeout (in blocks) - approximately 10 minutes
    pub let emergencyCancelTimeoutBlocks: UInt64
    
    // Multiplier tiers based on cell distance from price
    // Tier 0 = closest to price, Tier 5+ = furthest
    pub let multiplierTiers: {Int: UFix64}

    // ============================================================================
    // State
    // ============================================================================
    
    // House vault for payouts
    access(contract) var houseVault: @FlowToken.Vault
    
    // All positions by ID
    access(contract) var positions: {String: Position}
    
    // Positions by owner address
    access(contract) var positionsByOwner: {Address: [String]}
    
    // Position counter for unique IDs
    access(contract) var positionCounter: UInt64

    // ============================================================================
    // Position struct
    // ============================================================================
    
    pub struct Position {
        pub let id: String
        pub let owner: Address
        pub let stake: UFix64
        pub let row: Int
        pub let col: Int
        pub let multiplierTier: UFix64
        pub let entryPrice: UFix64
        pub let entryOracleUpdatedAtBlock: UInt64
        pub let entryBlockHeight: UInt64
        pub let expiryBlockHeight: UInt64
        pub var settled: Bool
        pub var payout: UFix64
        pub var won: Bool?
        pub var exitPrice: UFix64?

        init(
            id: String,
            owner: Address,
            stake: UFix64,
            row: Int,
            col: Int,
            multiplierTier: UFix64,
            entryPrice: UFix64,
            entryOracleUpdatedAtBlock: UInt64,
            entryBlockHeight: UInt64,
            expiryBlockHeight: UInt64
        ) {
            self.id = id
            self.owner = owner
            self.stake = stake
            self.row = row
            self.col = col
            self.multiplierTier = multiplierTier
            self.entryPrice = entryPrice
            self.entryOracleUpdatedAtBlock = entryOracleUpdatedAtBlock
            self.entryBlockHeight = entryBlockHeight
            self.expiryBlockHeight = expiryBlockHeight
            self.settled = false
            self.payout = 0.0
            self.won = nil
            self.exitPrice = nil
        }

        access(contract) fun settle(won: Bool, payout: UFix64, exitPrice: UFix64) {
            self.settled = true
            self.won = won
            self.payout = payout
            self.exitPrice = exitPrice
        }
    }

    // ============================================================================
    // Public Functions
    // ============================================================================

    // Fund the house vault (admin/sponsor)
    pub fun fundHouse(from: @FlowToken.Vault) {
        let amount = from.balance
        self.houseVault.deposit(from: <-from)
        emit HouseFunded(amount: amount)
    }

    // Open a new position
    pub fun openPosition(
        from: @FlowToken.Vault,
        row: Int,
        col: Int,
        oraclePrice: UFix64,
        oracleUpdatedAtBlock: UInt64
    ): String {
        let currentBlock = getCurrentBlock().height
        
        // Enforce oracle staleness at entry
        assert(
            currentBlock - oracleUpdatedAtBlock <= self.maxStaleBlocksEntry,
            message: "Oracle data too stale to open position"
        )
        
        let stake = from.balance
        assert(stake > 0.0, message: "Stake must be positive")
        
        // Calculate multiplier tier based on row distance from price
        let priceRow = Int(oraclePrice) % 12 // Map price to grid row
        let rowDistance = row > priceRow ? row - priceRow : priceRow - row
        let tier = rowDistance + col // Simple tier: row distance + column
        let multiplier = self.multiplierTiers[tier] ?? self.multiplierTiers[5]!
        
        // Generate position ID
        self.positionCounter = self.positionCounter + 1
        let positionId = "pos-".concat(self.positionCounter.toString())
        
        // Calculate expiry
        let expiryBlockHeight = currentBlock + self.positionDurationBlocks
        
        // Create position
        let position = Position(
            id: positionId,
            owner: from.owner!.address,
            stake: stake,
            row: row,
            col: col,
            multiplierTier: multiplier,
            entryPrice: oraclePrice,
            entryOracleUpdatedAtBlock: oracleUpdatedAtBlock,
            entryBlockHeight: currentBlock,
            expiryBlockHeight: expiryBlockHeight
        )
        
        // Store position
        self.positions[positionId] = position
        
        // Track by owner
        if self.positionsByOwner[from.owner!.address] == nil {
            self.positionsByOwner[from.owner!.address] = []
        }
        self.positionsByOwner[from.owner!.address]!.append(positionId)
        
        // Escrow stake in house vault
        self.houseVault.deposit(from: <-from)
        
        emit PositionOpened(
            positionId: positionId,
            owner: position.owner,
            stake: stake,
            row: row,
            col: col,
            multiplierTier: multiplier,
            entryPrice: oraclePrice,
            entryBlockHeight: currentBlock,
            expiryBlockHeight: expiryBlockHeight
        )
        
        return positionId
    }

    // Settle a position after expiry
    pub fun settlePosition(
        positionId: String,
        oraclePrice: UFix64,
        oracleUpdatedAtBlock: UInt64
    ): @FlowToken.Vault {
        let currentBlock = getCurrentBlock().height
        
        // Get position
        let position = self.positions[positionId]
            ?? panic("Position not found")
        
        assert(!position.settled, message: "Position already settled")
        assert(
            currentBlock >= position.expiryBlockHeight,
            message: "Position not yet expired"
        )
        
        // Enforce oracle staleness at settlement
        assert(
            currentBlock - oracleUpdatedAtBlock <= self.maxStaleBlocksSettle,
            message: "Oracle data too stale to settle"
        )
        
        // Determine win/loss based on price movement
        // Win if price moved in the direction implied by the cell position
        // Simplified: win if exit price differs from entry by more than the row distance
        let priceChange = oraclePrice > position.entryPrice
            ? oraclePrice - position.entryPrice
            : position.entryPrice - oraclePrice
        
        let threshold = UFix64(position.row) * 0.1 // 0.1 per row distance
        let won = priceChange >= threshold
        
        // Calculate payout
        var payout = 0.0
        if won {
            payout = position.stake * position.multiplierTier
        }
        
        // Update position
        position.settle(won: won, payout: payout, exitPrice: oraclePrice)
        self.positions[positionId] = position
        
        emit PositionSettled(
            positionId: positionId,
            won: won,
            payout: payout,
            exitPrice: oraclePrice
        )
        
        // Withdraw payout from house vault
        if payout > 0.0 {
            return <- self.houseVault.withdraw(amount: payout)
        }
        
        // Return empty vault if lost
        return <- FlowToken.createEmptyVault() as! @FlowToken.Vault
    }

    // Emergency cancel after timeout (refund stake)
    pub fun cancelPositionAfterTimeout(positionId: String): @FlowToken.Vault {
        let currentBlock = getCurrentBlock().height
        
        let position = self.positions[positionId]
            ?? panic("Position not found")
        
        assert(!position.settled, message: "Position already settled")
        
        // Must be past emergency timeout
        let emergencyThreshold = position.expiryBlockHeight + self.emergencyCancelTimeoutBlocks
        assert(
            currentBlock >= emergencyThreshold,
            message: "Emergency cancel not yet available"
        )
        
        // Mark as settled with refund
        position.settle(won: false, payout: position.stake, exitPrice: position.entryPrice)
        self.positions[positionId] = position
        
        emit PositionCanceled(positionId: positionId, refund: position.stake)
        
        // Return stake
        return <- self.houseVault.withdraw(amount: position.stake)
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    pub fun getPosition(positionId: String): Position? {
        return self.positions[positionId]
    }

    pub fun listPositionsForUser(address: Address): [Position] {
        let positionIds = self.positionsByOwner[address] ?? []
        var result: [Position] = []
        for id in positionIds {
            if let pos = self.positions[id] {
                result.append(pos)
            }
        }
        return result
    }

    pub fun getHouseBalance(): UFix64 {
        return self.houseVault.balance
    }

    // ============================================================================
    // Init
    // ============================================================================

    init() {
        // Configuration
        self.maxStaleBlocksEntry = 50      // ~1 minute on Flow
        self.maxStaleBlocksSettle = 100    // ~2 minutes on Flow
        self.positionDurationBlocks = 60   // ~1.5 minutes
        self.emergencyCancelTimeoutBlocks = 400 // ~10 minutes
        
        // Multiplier tiers (distance tier -> multiplier)
        self.multiplierTiers = {
            0: 1.15,
            1: 1.50,
            2: 2.00,
            3: 2.50,
            4: 3.50,
            5: 5.00
        }
        
        // Initialize state
        self.houseVault <- FlowToken.createEmptyVault() as! @FlowToken.Vault
        self.positions = {}
        self.positionsByOwner = {}
        self.positionCounter = 0
        
        emit ContractInitialized()
    }
}
