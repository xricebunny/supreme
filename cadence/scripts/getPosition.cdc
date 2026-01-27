// getPosition.cdc
// Get a position by ID

import MicroOptionsMVP from "../contracts/MicroOptionsMVP.cdc"

pub fun main(positionId: String): MicroOptionsMVP.Position? {
    return MicroOptionsMVP.getPosition(positionId: positionId)
}
