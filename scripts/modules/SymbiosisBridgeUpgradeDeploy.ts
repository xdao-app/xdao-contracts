import 'dotenv/config'

import { existsSync, renameSync, unlinkSync } from 'fs'
import { ethers, network, run, upgrades } from 'hardhat'

import { SymbiosisBridge } from '../../typechain-types'

const { upgradeProxy } = upgrades
const chainId = network.config.chainId

interface SymbiosisBridgeUpgardeAgruments {
  proxyAddress: string
}

const NETWORK_ARGUMENTS: Record<number, SymbiosisBridgeUpgardeAgruments> = {
  1: {
    proxyAddress: '0x0bB30688b39e707194F6a007FCAE63839B21CcdA'
  },
  56: {
    proxyAddress: '0x56a13eAfCfb20C0635c11EF8F822B82775E4deB1'
  },
  137: {
    proxyAddress: '0xF17E248eB6165f937B768BF47C9bD244A1275e62'
  },
  43114: {
    proxyAddress: '0x56a13eAfCfb20C0635c11EF8F822B82775E4deB1'
  },
  1337: {
    proxyAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
  }
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

  console.log(`Deploy Upgrade Started with chain ID: ${chainId}`)

  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)
  console.log(`Network: ${network.name}-${chainId}`)

  const symbiosisAddressesUpgrade = NETWORK_ARGUMENTS[chainId]

  if (!symbiosisAddressesUpgrade) {
    console.log('Symbiosis Addresses Upgrade undefined')
    return
  }

  const { proxyAddress } = symbiosisAddressesUpgrade

  const symbiosisBridge = (await upgradeProxy(
    proxyAddress,
    await ethers.getContractFactory('SymbiosisBridge'),
    { call: { fn: 'setOwner', args: [signer.address] } }
  )) as SymbiosisBridge

  await new Promise((r) => setTimeout(r, 10000))

  console.log('Upgrade success')

  console.log({ symbiosisBridge: symbiosisBridge.address })
  renameLocalManifest('SymbiosisBridge')

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    symbiosisBridge.address
  )

  console.log(
    `SymbiosisBridge implementation address: ${implementationAddress}`
  )

  console.log(`SymbiosisBridge owner address: ${await symbiosisBridge.owner()}`)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/SymbiosisBridge.sol:SymbiosisBridge'
    })
  } catch {
    console.log(`Verification problem (SymbiosisBridge)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
