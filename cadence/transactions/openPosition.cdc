// openPosition.cdc
// Open a new betting position on the grid

import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868
import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"
// import PublicPriceOracle from 0xORACLE_ADDRESS

transaction(row: Int, col: Int, amount: UFix64) {
    
    let stake: @FlowToken.Vault
    let oraclePrice: UFix64
    let oracleUpdatedAtBlock: UInt64
    
    prepare(signer: AuthAccount) {
        // Withdraw stake from signer's vault
        let vaultRef = signer.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow reference to FlowToken vault")
        
        self.stake <- vaultRef.withdraw(amount: amount) as! @FlowToken.Vault
        
        // Get oracle data
        // TODO: Replace with actual oracle call
        // let snapshot = PublicPriceOracle.getLatestPrice()
        // self.oraclePrice = snapshot.price
        // self.oracleUpdatedAtBlock = snapshot.updatedAtBlock
        
        // Mock oracle for hackathon testing
        self.oraclePrice = 100.50
        self.oracleUpdatedAtBlock = getCurrentBlock().height - 5
    }
    
    execute {
        let positionId = MicroOptionsMVP.openPosition(
            from: <-self.stake,
            row: row,
            col: col,
            oraclePrice: self.oraclePrice,
            oracleUpdatedAtBlock: self.oracleUpdatedAtBlock
        )
        
        log("Opened position: ".concat(positionId))
    }
}
