import { ethers, network, upgrades } from 'hardhat'

import { VestingModuleV2__factory } from '../../typechain-types'

const proxyAddress = ''
const start = 0
const duration = 0

async function main() {
  console.log(`Network ${network.config.chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const VestingModuleV2 = await ethers.getContractFactory('VestingModuleV2')

  const upgraded = await upgrades.upgradeProxy(proxyAddress, VestingModuleV2)

  await upgraded.deployed()

  console.log(`Upgraded: ${upgraded.address}`)

  const tx = await VestingModuleV2__factory.connect(
    upgraded.address,
    signer
  ).setConfig(start, duration)

  console.log(`Tx: ${tx.hash}`)

  await tx.wait()

  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
