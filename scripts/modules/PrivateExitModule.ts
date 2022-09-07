import * as dotenv from 'dotenv'
import { ethers, run } from 'hardhat'

import { PrivateExitModule__factory } from '../../typechain-types'

dotenv.config()

async function main() {
  const signers = await ethers.getSigners()

  const privateExitModule = await new PrivateExitModule__factory(
    signers[0]
  ).deploy()

  await privateExitModule.deployed()

  console.log('PrivateExitModule:', privateExitModule.address)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: privateExitModule.address,
      contract: 'contracts/modules/PrivateExitModule.sol:PrivateExitModule'
    })
  } catch {
    console.log('Verification problem (PrivateExitModule)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
