// settlePosition.cdc
// Settle a position after expiry and receive payout

import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868
import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"
// import PublicPriceOracle from 0xORACLE_ADDRESS

transaction(positionId: String) {
    
    let receiverRef: &{FungibleToken.Receiver}
    let oraclePrice: UFix64
    let oracleUpdatedAtBlock: UInt64
    
    prepare(signer: AuthAccount) {
        // Get receiver capability for payout
        self.receiverRef = signer.getCapability(/public/flowTokenReceiver)
            .borrow<&{FungibleToken.Receiver}>()
            ?? panic("Could not borrow receiver reference")
        
        // Get oracle data
        // TODO: Replace with actual oracle call
        // let snapshot = PublicPriceOracle.getLatestPrice()
        // self.oraclePrice = snapshot.price
        // self.oracleUpdatedAtBlock = snapshot.updatedAtBlock
        
        // Mock oracle for hackathon testing
        self.oraclePrice = 102.75
        self.oracleUpdatedAtBlock = getCurrentBlock().height - 3
    }
    
    execute {
        let payout <- MicroOptionsMVP.settlePosition(
            positionId: positionId,
            oraclePrice: self.oraclePrice,
            oracleUpdatedAtBlock: self.oracleUpdatedAtBlock
        )
        
        if payout.balance > 0.0 {
            log("Received payout: ".concat(payout.balance.toString()))
            self.receiverRef.deposit(from: <-payout)
        } else {
            destroy payout
            log("Position lost, no payout")
        }
    }
}
