import 'dotenv/config'

import { existsSync, renameSync, unlinkSync } from 'fs'
import { ethers, network, run, upgrades } from 'hardhat'

import { DocumentSign } from '../../typechain-types'

const { deployProxy } = upgrades
const chainId = network.config.chainId

const deleteLocalManifest = () => {
  existsSync(`.openzeppelin/unknown-${chainId}.json`) &&
    unlinkSync(`.openzeppelin/unknown-${chainId}.json`)
}

const renameLocalManifest = (contractName: string) => {
  renameSync(
    `.openzeppelin/unknown-${chainId}.json`,
    `.openzeppelin/${contractName}/unknown-${chainId}.json`
  )
}

const main = async () => {
  if (!chainId) {
    console.log('ChainId undefined')
    return
  }

  console.log(`Deploy Started with chain ID: ${chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)
  console.log(`Network: ${network.name}-${chainId}`)

  deleteLocalManifest()

  const documentSignModule = (await deployProxy(
    await ethers.getContractFactory('DocumentSign'),
    ['0x72cc6E4DE47f673062c41C67505188144a0a3D84']
  )) as DocumentSign

  await documentSignModule.deployed()

  console.log({ documentSignModule: documentSignModule.address })

  renameLocalManifest('DocumentSignModule')

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    documentSignModule.address
  )

  console.log(
    `DocumentSignModule implementation address: ${implementationAddress}`
  )

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/DocumentSignModule.sol:DocumentSignModule'
    })
  } catch {
    console.log(`Verification problem (DocumentSignModule)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
