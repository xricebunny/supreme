import "RandomConsumer"

/// BonusRound — streak-based bonus multiplier using secure on-chain randomness.
///
/// Players earn bonus rounds by winning consecutive bets in PredictionGame.
/// Uses Flow's RandomConsumer commit-reveal pattern backed by the protocol's
/// Distributed Random Beacon (RandomBeaconHistory + Xorshift128plus PRG).
///
/// Why commit-reveal instead of revertibleRandom()?
///   revertibleRandom() is vulnerable to post-selection attacks — a caller can
///   inspect the random result and abort the transaction if unfavorable, getting
///   unlimited retries at the cost of gas. The commit-reveal pattern eliminates
///   this by separating the commitment (before the random seed is known) from
///   the reveal (after the seed is fixed). Even if the reveal transaction is
///   reverted, all inputs that determine the outcome were locked at commit time.
///
/// Flow:
///   1. Admin records wins/losses after PredictionGame settlements
///   2. Player with streak >= threshold requests a bonus round (COMMIT phase)
///      → RandomConsumer.Request resource created and stored
///   3. In a subsequent block, admin reveals the result (REVEAL phase)
///      → RandomBeaconHistory provides the source of randomness for the commit block
///      → Xorshift128plus PRG expands it into a tier selection
///   4. The random tier maps to a multiplier boost for the player's next bet
///
access(all) contract BonusRound {

    // ── Events ─────────────────────────────────────────────────────────────

    access(all) event WinRecorded(player: Address, newStreak: UInt64)
    access(all) event StreakReset(player: Address)
    access(all) event BonusRequested(requestId: UInt64, player: Address, commitBlock: UInt64)
    access(all) event BonusRevealed(requestId: UInt64, player: Address, multiplierBoost: UFix64, tier: UInt8)
    access(all) event BonusRedeemed(requestId: UInt64, player: Address, multiplierBoost: UFix64)

    // ── Configuration ──────────────────────────────────────────────────────

    /// Consecutive wins needed to earn a bonus round.
    access(all) let streakThreshold: UInt64

    /// Possible bonus multiplier outcomes, indexed by tier.
    access(all) let multiplierTiers: [UFix64]

    access(all) let AdminStoragePath: StoragePath

    // ── RandomConsumer ─────────────────────────────────────────────────────

    /// The Consumer resource handles the commit-reveal lifecycle.
    /// Commit: creates a Request pinned to the current block height.
    /// Reveal: fulfills the Request using RandomBeaconHistory's source of
    ///         randomness for the committed block (available one block later).
    access(self) let consumer: @RandomConsumer.Consumer

    // ── Bonus Request ──────────────────────────────────────────────────────

    access(all) struct BonusRequest {
        access(all) let id: UInt64
        access(all) let player: Address
        access(all) let commitBlock: UInt64
        access(all) var revealed: Bool
        access(all) var redeemed: Bool
        access(all) var multiplierBoost: UFix64?
        access(all) var tier: UInt8?

        init(id: UInt64, player: Address, commitBlock: UInt64) {
            self.id = id
            self.player = player
            self.commitBlock = commitBlock
            self.revealed = false
            self.redeemed = false
            self.multiplierBoost = nil
            self.tier = nil
        }

        access(contract) fun reveal(multiplierBoost: UFix64, tier: UInt8) {
            self.revealed = true
            self.multiplierBoost = multiplierBoost
            self.tier = tier
        }

        access(contract) fun redeem() {
            self.redeemed = true
        }
    }

    // ── State ──────────────────────────────────────────────────────────────

    /// Current win streak per player.
    access(contract) var streaks: {Address: UInt64}

    /// All bonus requests by ID (metadata).
    access(contract) var requests: {UInt64: BonusRequest}

    /// Pending RandomConsumer.Request resources awaiting reveal.
    /// Stored separately from the BonusRequest struct because Request is a resource.
    access(contract) var pendingRandomRequests: @{UInt64: RandomConsumer.Request}

    /// Auto-incrementing request ID counter.
    access(contract) var requestCounter: UInt64

    /// Tracks the active (unredeemed) bonus request per player. One at a time.
    access(contract) var activeRequestByPlayer: {Address: UInt64}

    // ── Admin Resource ─────────────────────────────────────────────────────

    access(all) resource Admin {

        /// Record a win — increments the player's streak.
        access(all) fun recordWin(player: Address) {
            let current = BonusRound.streaks[player] ?? 0
            BonusRound.streaks[player] = current + 1
            emit WinRecorded(player: player, newStreak: current + 1)
        }

        /// Record a loss — resets the player's streak to zero.
        access(all) fun recordLoss(player: Address) {
            BonusRound.streaks[player] = 0
            emit StreakReset(player: player)
        }

        /// Reveal a bonus round using Flow's RandomBeaconHistory.
        /// Must be called in a block AFTER the commit block so that the
        /// random beacon source for the commit block is available.
        /// The RandomConsumer.Consumer handles all the cryptographic details:
        ///   1. Fetches the source of randomness from RandomBeaconHistory
        ///   2. Seeds a Xorshift128plus PRG with the source + request UUID salt
        ///   3. Uses rejection sampling to pick a tier without modulo bias
        access(all) fun revealBonusRound(requestId: UInt64) {
            let request = BonusRound.requests[requestId]
                ?? panic("Bonus request not found")

            assert(!request.revealed, message: "Already revealed")

            // Move the RandomConsumer.Request resource out of pending storage
            let randomRequest <- BonusRound.pendingRandomRequests.remove(key: requestId)
                ?? panic("No pending random request for this bonus")

            // Fulfill using the Consumer's commit-reveal pipeline.
            // This calls RandomBeaconHistory.sourceOfRandomness(atBlockHeight: commitBlock)
            // which returns the protocol's random beacon value for that block —
            // a value that was not known when the commit transaction executed.
            let tierCount = UInt64(BonusRound.multiplierTiers.length)
            let tierIndex = BonusRound.consumer.fulfillRandomInRange(
                request: <-randomRequest,
                min: 0,
                max: tierCount - 1
            )
            let boost = BonusRound.multiplierTiers[tierIndex]

            request.reveal(multiplierBoost: boost, tier: UInt8(tierIndex))
            BonusRound.requests[requestId] = request

            emit BonusRevealed(
                requestId: requestId,
                player: request.player,
                multiplierBoost: boost,
                tier: UInt8(tierIndex)
            )
        }

        /// Mark a bonus as redeemed (applied to a bet).
        access(all) fun redeemBonus(requestId: UInt64) {
            let request = BonusRound.requests[requestId]
                ?? panic("Bonus request not found")

            assert(request.revealed, message: "Not yet revealed")
            assert(!request.redeemed, message: "Already redeemed")

            request.redeem()
            BonusRound.requests[requestId] = request
            BonusRound.activeRequestByPlayer.remove(key: request.player)

            emit BonusRedeemed(
                requestId: requestId,
                player: request.player,
                multiplierBoost: request.multiplierBoost!
            )
        }
    }

    // ── Public Functions ───────────────────────────────────────────────────

    /// Request a bonus round (COMMIT phase).
    /// Player must have streak >= threshold and no active unredeemed bonus.
    /// Consumes the streak. Creates a RandomConsumer.Request pinned to the
    /// current block — the random beacon value for this block won't be
    /// available until the next block, preventing prediction.
    access(all) fun requestBonusRound(player: Address): UInt64 {
        let streak = self.streaks[player] ?? 0
        assert(
            streak >= self.streakThreshold,
            message: "Need streak of ".concat(self.streakThreshold.toString())
                .concat(", have ").concat(streak.toString())
        )

        assert(
            self.activeRequestByPlayer[player] == nil,
            message: "Already have an active bonus request"
        )

        self.requestCounter = self.requestCounter + 1
        let requestId = self.requestCounter

        // COMMIT: request randomness from the Consumer.
        // This creates a Request resource pinned to the current block height.
        // The source of randomness for this block is NOT yet available to
        // any transaction in this block, so the outcome cannot be predicted.
        let randomRequest <- self.consumer.requestRandomness()
        let commitBlock = getCurrentBlock().height

        // Store the Request resource for later reveal
        self.pendingRandomRequests[requestId] <-! randomRequest

        let bonusRequest = BonusRequest(
            id: requestId,
            player: player,
            commitBlock: commitBlock
        )
        self.requests[requestId] = bonusRequest
        self.activeRequestByPlayer[player] = requestId

        // Streak consumed on request
        self.streaks[player] = 0

        emit BonusRequested(
            requestId: requestId,
            player: player,
            commitBlock: commitBlock
        )

        return requestId
    }

    // ── View Functions ─────────────────────────────────────────────────────

    access(all) view fun getStreak(player: Address): UInt64 {
        return self.streaks[player] ?? 0
    }

    access(all) view fun getRequest(requestId: UInt64): BonusRequest? {
        return self.requests[requestId]
    }

    access(all) view fun getActiveRequest(player: Address): BonusRequest? {
        if let requestId = self.activeRequestByPlayer[player] {
            return self.requests[requestId]
        }
        return nil
    }

    access(all) view fun getRequestCount(): UInt64 {
        return self.requestCounter
    }

    // ── Init ───────────────────────────────────────────────────────────────

    init() {
        self.streakThreshold = 3
        self.multiplierTiers = [1.5, 2.0, 3.0, 5.0]
        self.AdminStoragePath = /storage/bonusRoundAdmin

        // Create the RandomConsumer.Consumer for commit-reveal randomness
        self.consumer <- RandomConsumer.createConsumer()

        self.streaks = {}
        self.requests = {}
        self.pendingRandomRequests <- {}
        self.requestCounter = 0
        self.activeRequestByPlayer = {}

        let admin <- create Admin()
        self.account.storage.save(<-admin, to: self.AdminStoragePath)
    }
}
