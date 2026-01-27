// fundHouse.cdc
// Fund the house vault with FlowToken for payouts

import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868
import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"

transaction(amount: UFix64) {
    
    let vault: @FlowToken.Vault
    
    prepare(signer: AuthAccount) {
        // Withdraw from signer's vault
        let vaultRef = signer.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow reference to FlowToken vault")
        
        self.vault <- vaultRef.withdraw(amount: amount) as! @FlowToken.Vault
    }
    
    execute {
        MicroOptionsMVP.fundHouse(from: <-self.vault)
    }
}
