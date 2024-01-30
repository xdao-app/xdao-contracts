import 'dotenv/config'

import { ethers, network, run, upgrades } from 'hardhat'


const { upgradeProxy } = upgrades

interface UpgardeAgruments {
  proxyAddress: string
}

const NETWORK_ARGUMENTS: Record<number, UpgardeAgruments> = {
  1: {
    proxyAddress: "0x711E14eBC41A8f1595433FA4409a50BC9838Fc03"
  },
  56: {
    proxyAddress: '0x97330364E1a9209214ef5107a04798170D351b68'
  },
  137: {
    proxyAddress: '0x8AC7D4cEA044fB0d0153c28d145aE350bA25f1bA'
  },
  43114: {
    proxyAddress: '0x096BE3B573c74034Ba5A7E08DE412691DB9449fd'
  },
  204: {
    proxyAddress: "0x096BE3B573c74034Ba5A7E08DE412691DB9449fd"
  },
  10: {
    proxyAddress: "0xaB5836182cc9970695faa74A0890Cd7099955d5a"
  },
  8453: {
    proxyAddress: "0x0b7b154c7dB7d50a500a3eF89eddc9A746787185"
  },
  5000: {
    proxyAddress: "0x096BE3B573c74034Ba5A7E08DE412691DB9449fd"
  },
  42161: {
    proxyAddress: "0x0cf784bba0FFA0a7006f3Ee7e4357E643a07F6e7"
  },
  42170: {
    proxyAddress: "0x096BE3B573c74034Ba5A7E08DE412691DB9449fd"
  },
  84531: {
    proxyAddress: "0x03e40dB4dcE9Fec44232B942440a1BC65563f001"
  }
}


const main = async () => {
  console.log(`Deploy Upgrade Started with chain ID: ${network.config.chainId}`)
  if (!network.config.chainId) {
    return
  }
  
  const [signer] = await ethers.getSigners()

  console.log(`Account: ${signer.address}`)

  const crowdfundingAddressesUpgrade = NETWORK_ARGUMENTS[network.config.chainId]

  if (!crowdfundingAddressesUpgrade) {
    console.log('Crowdfunding Addresses Upgrade undefined')
    return
  }

  const { proxyAddress } = crowdfundingAddressesUpgrade
  console.log({ proxyAddress });


  const CrowdfundingModule = await ethers.getContractFactory('CrowdfundingModule')

  const upgraded = await upgrades.upgradeProxy(proxyAddress, CrowdfundingModule)

  await upgraded.deployed()


  console.log({ crowdfundingModule: upgraded.address })
  
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    upgraded.address
  )

  console.log(
    `CrowdfundingModule implementation address: ${implementationAddress}`
  )

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: implementationAddress,
      contract: 'contracts/modules/CrowdfundingModule.sol:CrowdfundingModule'
    })
  } catch {
    console.log("Verification problem (crowdfundingModule)")
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
