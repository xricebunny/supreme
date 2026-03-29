import "Burner"

import "RandomBeaconHistory"
import "Xorshift128plus"

/// This contract makes it easy to consume randomness securely from the Flow protocol's random beacon.
/// It provides a simple construct to commit to a request, and reveal the randomness in a secure manner
/// as well as helper functions to generate random numbers in a range without bias.
///
/// See an example implementation in the repository: https://github.com/onflow/random-coin-toss
///
access(all) contract RandomConsumer {

    /* --- PATHS --- */
    //
    /// Canonical path for Consumer storage
    access(all) let ConsumerStoragePath: StoragePath

    /* --- EVENTS --- */
    //
    access(all) event RandomnessRequested(requestUUID: UInt64, block: UInt64)
    access(all) event RandomnessSourced(requestUUID: UInt64, block: UInt64, randomSource: [UInt8])
    access(all) event RandomnessFulfilled(requestUUID: UInt64, randomResult: UInt64)
    access(all) event RandomnessFulfilledWithPRG(requestUUID: UInt64)

    ///////////////
    // PUBLIC FUNCTIONS
    ///////////////

    /// Retrieves a revertible random number in the range [min, max].
    access(all) fun getRevertibleRandomInRange(min: UInt64, max: UInt64): UInt64 {
        return min + revertibleRandom<UInt64>(modulo: max - min + 1)
    }

    /// Retrieves a random number in the range [min, max] using the provided PRG reference.
    /// Uses rejection sampling to avoid modulo bias.
    access(all) fun getNumberInRange(prg: &Xorshift128plus.PRG, min: UInt64, max: UInt64): UInt64 {
        pre {
            min < max:
                "RandomConsumer.getNumberInRange: Cannot get random number with the provided range! "
                .concat(" The min must be less than the max. Provided min of ")
                .concat(min.toString()).concat(" and max of ".concat(max.toString()))
        }
        let range = max - min
        let bitsRequired = UInt256(self._mostSignificantBit(range))
        let mask: UInt256 = (1 << bitsRequired) - 1

        let shiftLimit: UInt256 = 256 / bitsRequired
        var shifts: UInt256 = 0

        var candidate: UInt64 = 0
        var value: UInt256 = prg.nextUInt256()

        while true {
            candidate = UInt64(value & mask)
            if candidate <= range {
                break
            }

            value = value >> bitsRequired
            shifts = shifts + 1

            if shifts == shiftLimit {
                value = prg.nextUInt256()
                shifts = 0
            }
        }

        return min + candidate
    }

    /// Returns a new Consumer resource
    access(all) fun createConsumer(): @Consumer {
        return <-create Consumer()
    }

    /* CONSUMER ADAPTERS */

    access(all) fun requestFutureRandomness(at blockHeight: UInt64): @Request {
        return <-self.borrowConsumer().requestFutureRandomness(at: blockHeight)
    }

    access(all) fun fulfillRandomRequest(_ request: @Request): UInt64 {
        return self.borrowConsumer().fulfillRandomRequest(<-request)
    }

    access(all) fun fulfillRandomRequestInRange(_ request: @Request, min: UInt64, max: UInt64): UInt64 {
        return self.borrowConsumer().fulfillRandomInRange(request: <-request, min: min, max: max)
    }

    access(all) fun fulfillRandomRequestWithPRG(_ request: @Request): Xorshift128plus.PRG {
        return self.borrowConsumer().fulfillWithPRG(request: <-request)
    }

    ///////////////
    // CONSTRUCTS
    ///////////////

    access(all) entitlement Commit
    access(all) entitlement Reveal

    /// Interface to allow for a Request to be contained within another resource.
    access(all) resource interface RequestWrapper {
        access(all) var request: @Request?

        access(all) view fun getRequestBlock(): UInt64? {
            post {
                result == nil || result! == self.request?.block:
                    "RandomConsumer.RequestWrapper.getRequestBlock(): Must return nil or the block height of RequestWrapper.request"
            }
            return self.request?.block ?? nil
        }

        access(all) view fun canFullfillRequest(): Bool {
            post {
                result == self.request?.canFulfill() ?? false:
                    "RandomConsumer.RequestWrapper.canFullfillRequest(): Must return the result of RequestWrapper.request.canFulfill()"
            }
            return self.request?.canFulfill() ?? false
        }

        access(Reveal) fun popRequest(): @Request {
            pre {
                self.request != nil: "RandomConsumer.RequestWrapper.popRequest(): Request must not be nil before popRequest"
            }
            post {
                self.request == nil:
                    "RandomConsumer.RequestWrapper.popRequest(): Request must be nil after popRequest"
                result.uuid == before((self.request?.uuid)!):
                    "RandomConsumer.RequestWrapper.popRequest(): Request uuid must match result uuid"
            }
            let req <-self.request <- nil
            return <-req!
        }
    }

    /// A resource representing a request for randomness
    access(all) resource Request {
        access(all) let block: UInt64
        access(all) var fulfilled: Bool

        init(_ blockHeight: UInt64) {
            pre {
                getCurrentBlock().height <= blockHeight:
                    "Requested randomness for block \(blockHeight) which has passed. Can only request randomness sourced from future block heights."
            }
            self.block = blockHeight
            self.fulfilled = false
        }

        access(all) view fun canFulfill(): Bool {
            return !self.fulfilled && getCurrentBlock().height > self.block
        }

        access(contract) fun _fulfill(): [UInt8] {
            pre {
                !self.fulfilled:
                    "RandomConsumer.Request.fulfill(): The random request has already been fulfilled."
                self.block < getCurrentBlock().height:
                    "RandomConsumer.Request.fulfill(): Cannot fulfill random request before the eligible block height of "
                    .concat(((self.block + 1).toString()))
            }
            self.fulfilled = true
            let res = RandomBeaconHistory.sourceOfRandomness(atBlockHeight: self.block).value

            emit RandomnessSourced(requestUUID: self.uuid, block: self.block, randomSource: res)

            return res
        }
    }

    /// This resource enables the easy implementation of secure randomness, implementing the commit-reveal pattern
    /// and using a PRG to generate random numbers from the protocol's random source.
    access(all) resource Consumer {

        /* ------ COMMIT STEP ------ */

        access(Commit) fun requestRandomness(): @Request {
            post {
                result.block == getCurrentBlock().height:
                    "Requested randomness for block height \(getCurrentBlock().height) but returned Request for randomness at block \(result.block)"
            }
            let currentHeight = getCurrentBlock().height
            let req <-create Request(currentHeight)
            emit RandomnessRequested(requestUUID: req.uuid, block: req.block)
            return <-req
        }

        access(Commit) fun requestFutureRandomness(at blockHeight: UInt64): @Request  {
            post {
                blockHeight == result.block:
                    "Requested randomness for block height \(blockHeight) but returned Request for randomness at block \(result.block)"
            }
            let req <-create Request(blockHeight)
            emit RandomnessRequested(requestUUID: req.uuid, block: req.block)
            return <-req
        }

        /* ------ REVEAL STEP ------ */

        access(Reveal) fun fulfillRandomRequest(_ request: @Request): UInt64 {
            let reqUUID = request.uuid
            let prg = self._getPRGFromRequest(request: <-request)
            let res = prg.nextUInt64()
            emit RandomnessFulfilled(requestUUID: reqUUID, randomResult: res)
            return res
        }

        access(Reveal) fun fulfillRandomInRange(request: @Request, min: UInt64, max: UInt64): UInt64 {
            pre {
                min < max:
                    "RandomConsumer.Consumer.fulfillRandomInRange(): Cannot fulfill random number with the provided range! "
                    .concat(" The min must be less than the max. Provided min of ")
                    .concat(min.toString()).concat(" and max of ".concat(max.toString()))
            }
            let reqUUID = request.uuid
            let prg = self._getPRGFromRequest(request: <-request)
            let prgRef: &Xorshift128plus.PRG = &prg
            let res = RandomConsumer.getNumberInRange(prg: prgRef, min: min, max: max)
            emit RandomnessFulfilled(requestUUID: reqUUID, randomResult: res)
            return res
        }

        access(Reveal) fun fulfillWithPRG(request: @Request): Xorshift128plus.PRG {
            let reqUUID = request.uuid
            let prg = self._getPRGFromRequest(request: <-request)
            emit RandomnessFulfilledWithPRG(requestUUID: reqUUID)
            return prg
        }

        access(self)
        fun _getPRGFromRequest(request: @Request): Xorshift128plus.PRG {
            let source = request._fulfill()
            let salt = request.uuid.toBigEndianBytes()
            Burner.burn(<-request)
            return Xorshift128plus.PRG(sourceOfRandomness: source, salt: salt)
        }
    }

    access(self) view fun _mostSignificantBit(_ x: UInt64): UInt8 {
        var bits: UInt8 = 0
        var tmp: UInt64 = x
        while tmp > 0 {
            tmp = tmp >> 1
            bits = bits + 1
        }
        return bits
    }

    access(self)
    fun borrowConsumer(): auth(Commit, Reveal) &Consumer {
        let path = /storage/consumer
        return self.account.storage.borrow<auth(Commit, Reveal) &Consumer>(from: path)
            ?? panic("Consumer not found - ensure the Consumer has been initialized at \(path)")
    }

    init() {
        self.ConsumerStoragePath = StoragePath(identifier: "RandomConsumer_".concat(self.account.address.toString()))!
        self.account.storage.save(<-create Consumer(), to: /storage/consumer)
    }
}
