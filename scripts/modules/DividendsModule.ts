import * as dotenv from 'dotenv'
import { ethers, run } from 'hardhat'

import { DividendsModule__factory } from '../../typechain-types'

dotenv.config()

async function main() {
  const [signer] = await ethers.getSigners()

  const dividendsModule = await new DividendsModule__factory(signer).deploy()

  await dividendsModule.deployed()

  console.log('DividendsModule:', dividendsModule.address)

  try {
    await run('verify:verify', {
      address: dividendsModule.address,
      contract: 'contracts/modules/DividendsModule.sol:DividendsModule'
    })
  } catch {
    console.log('Verification problem (DividendsModule)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
