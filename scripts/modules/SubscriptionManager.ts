import { ethers, network, run, upgrades } from 'hardhat'

import { SubscriptionManager } from '../../typechain-types'

async function main() {
  console.log(`Deploy Started with chain ID: ${network.config.chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const subscriptionManager = (await upgrades.deployProxy(
    await ethers.getContractFactory('SubscriptionManager'),
    ['0x71eebA415A523F5C952Cc2f06361D5443545Ad28', '', 2592000],
    { kind: 'uups' }
  )) as SubscriptionManager

  await subscriptionManager.deployed()

  console.log('SubscriptionManager:', subscriptionManager.address)

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    subscriptionManager.address
  )

  console.log('SubscriptionManager Implementation:', implementationAddress)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/SubscriptionManager.sol:SubscriptionManager'
    })
  } catch {
    console.log('Verification problem (SubscriptionManager)')
  }

  await (await subscriptionManager.editDurationPerToken(0, 25920)).wait()

  await (
    await subscriptionManager.grantRole(
      await subscriptionManager.MANAGER_ROLE(),
      ''
    )
  ).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
