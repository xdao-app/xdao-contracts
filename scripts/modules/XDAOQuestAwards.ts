import { ethers, run } from 'hardhat'

import { XDAOQuestAwards__factory } from '../../typechain-types'

async function main() {
  const [signer] = await ethers.getSigners()

  const token = await new XDAOQuestAwards__factory(signer).deploy()

  await token.deployed()

  console.log('XDAOQuestAwards:', token.address)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: token.address,
      contract: 'contracts/modules/XDAOQuestAwards.sol:XDAOQuestAwards'
    })
  } catch {
    console.log('Verification problem (XDAOQuestAwards)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
