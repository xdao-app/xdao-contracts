import { ethers, network, run, upgrades } from 'hardhat'

import { MerkleDistributor } from '../../typechain-types'

async function main() {
  console.log(`Deploy Started with chain ID: ${network.config.chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const distributor = (await upgrades.deployProxy(
    await ethers.getContractFactory('MerkleDistributor'),
    ['0x2953399124f0cbb46d2cbacd8a89cf0599974963'],
    { kind: 'uups' }
  )) as MerkleDistributor

  await distributor.deployed()

  console.log('MerkleDistributor:', distributor.address)

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    distributor.address
  )

  console.log('MerkleDistributor Implementation:', implementationAddress)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/MerkleDistributor.sol:MerkleDistributor'
    })
  } catch {
    console.log('Verification problem (MerkleDistributor)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
