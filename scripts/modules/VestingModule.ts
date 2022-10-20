import { ethers, network, run, upgrades } from 'hardhat'

import { VestingModule } from '../../typechain-types'

const tokenAddress = ''
const startTimestamp = 0
const duration = 0

async function main() {
  console.log(`Deploy Started with chain ID: ${network.config.chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const vestingModule = (await upgrades.deployProxy(
    await ethers.getContractFactory('VestingModule'),
    [tokenAddress, startTimestamp, duration],
    { kind: 'uups' }
  )) as VestingModule

  await vestingModule.deployed()

  console.log('VestingModule:', vestingModule.address)

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    vestingModule.address
  )

  console.log('VestingModule Implementation:', implementationAddress)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/VestingModule.sol:VestingModule'
    })
  } catch {
    console.log('Verification problem (VestingModule)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
