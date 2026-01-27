// listPositionsForUser.cdc
// Get all positions for a user address

import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"

pub fun main(address: Address): [MicroOptionsMVP.Position] {
    return MicroOptionsMVP.listPositionsForUser(address: address)
}
