import { ethers, upgrades } from 'hardhat'

import { LaunchpadModule } from '../../typechain-types'

async function main() {
  const Launchpad = await ethers.getContractFactory('LaunchpadModule')

  const launchpad = (await upgrades.deployProxy(Launchpad)) as LaunchpadModule

  await launchpad.deployed()

  console.log('LaunchpadModule:', launchpad.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
