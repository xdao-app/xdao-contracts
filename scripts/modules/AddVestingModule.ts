import { parseEther } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'

import { VestingModule__factory } from '../../typechain-types'

const vestingModuleAddress = ''

const distribution = [
  {
    amount: 0,
    address: ''
  }
]

async function main() {
  console.log(`Action Started with chain ID: ${network.config.chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const addresses = distribution.map(({ address }) => address)
  const amounts = distribution.map(({ amount }) => amount)

  const vestingModule = VestingModule__factory.connect(
    vestingModuleAddress,
    signer
  )

  const tx = await vestingModule.addAllocations(
    addresses,
    amounts.map((a) => parseEther(a + ''))
  )

  console.log('Add Allocations tx started')

  await tx.wait()

  console.log('Add Allocations tx succeed')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
