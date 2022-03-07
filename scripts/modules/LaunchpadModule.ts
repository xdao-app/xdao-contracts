import { ethers, run, upgrades } from 'hardhat'

import { LaunchpadModule } from '../../typechain-types'

async function main() {
  const Launchpad = await ethers.getContractFactory('LaunchpadModule')

  const launchpad = (await upgrades.deployProxy(Launchpad)) as LaunchpadModule

  await launchpad.deployed()

  console.log('LaunchpadModule:', launchpad.address)

  await (
    await launchpad.setCoreAddresses(
      '0x72cc6E4DE47f673062c41C67505188144a0a3D84',
      '0xCA49EcF7e7bb9bBc9D1d295384663F6BA5c0e366',
      '0xB42DD79C056d4b511c07c29d4c35403b47bE29B9'
    )
  ).wait()

  console.log('LaunchpadModule: SetCoreAddresses Success')

  try {
    await run('verify:verify', {
      address: '',
      contract: 'contracts/modules/LaunchpadModule.sol:LaunchpadModule'
    })
  } catch {
    console.log('Verification problem (LaunchpadModule)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
