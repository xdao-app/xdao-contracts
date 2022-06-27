import { ethers, network, run } from 'hardhat'

import { AdvancedViewer__factory } from '../../typechain-types'

const FACTORY_ADDRESS = '0x72cc6E4DE47f673062c41C67505188144a0a3D84'

async function main() {
  const [signer] = await ethers.getSigners()

  console.log(`Account ${signer.address}`)
  console.log(`Network ${network.name}-${network.config.chainId}`)

  const advancedViewer = await new AdvancedViewer__factory(signer).deploy(
    FACTORY_ADDRESS
  )

  await advancedViewer.deployed()

  console.log('Advanced Viewer:', advancedViewer.address)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: advancedViewer.address,
      contract: 'contracts/viewers/AdvancedViewer.sol:AdvancedViewer'
    })
  } catch {
    console.log('Verification problem (AdvancedViewer)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
