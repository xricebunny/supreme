// cancelPositionAfterTimeout.cdc
// Emergency cancel a position after timeout (refund stake)

import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868
import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"

transaction(positionId: String) {
    
    let receiverRef: &{FungibleToken.Receiver}
    
    prepare(signer: AuthAccount) {
        // Get receiver capability for refund
        self.receiverRef = signer.getCapability(/public/flowTokenReceiver)
            .borrow<&{FungibleToken.Receiver}>()
            ?? panic("Could not borrow receiver reference")
    }
    
    execute {
        let refund <- MicroOptionsMVP.cancelPositionAfterTimeout(positionId: positionId)
        
        log("Received refund: ".concat(refund.balance.toString()))
        self.receiverRef.deposit(from: <-refund)
    }
}
