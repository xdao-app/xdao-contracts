import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import 'hardhat-tracer'
import 'solidity-coverage'

import * as dotenv from 'dotenv'
import { HardhatUserConfig, task } from 'hardhat/config'
dotenv.config()

task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

const vanityKey =
  '960fb429377453d0a1aec14807813d01f989cc5504270e514bf2a9f7d843253a'

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 15e6
    },

    mainnet: {
      url: `https://speedy-nodes-nyc.moralis.io/${process.env.MORALIS_KEY}/eth/mainnet`,
      chainId: 1,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    heco: {
      url: `https://http-mainnet.hecochain.com`,
      chainId: 128,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    bsc: {
      url: `https://speedy-nodes-nyc.moralis.io/${process.env.MORALIS_KEY}/bsc/mainnet`,
      chainId: 56,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    fantom: {
      url: `https://rpc.ftm.tools/`,
      chainId: 250,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    avalanche: {
      url: `https://api.avax.network/ext/bc/C/rpc`,
      chainId: 43114,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    polygon: {
      url: `https://polygon-rpc.com`,
      chainId: 137,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey],
      gasPrice: 40000000000
    },

    celo: {
      url: `https://forno.celo.org`,
      chainId: 42220,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    oec: {
      url: `https://exchainrpc.okex.org`,
      chainId: 66,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    metis: {
      url: `https://andromeda.metis.io/?owner=1088`,
      chainId: 1088,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    aurora: {
      url: `https://mainnet.aurora.dev`,
      chainId: 1313161554,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    optimism: {
      url: `https://mainnet.optimism.io`,
      chainId: 10,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    rinkeby: {
      url: `https://speedy-nodes-nyc.moralis.io/${process.env.MORALIS_KEY}/eth/rinkeby`,
      chainId: 4,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    }
  },

  solidity: {
    version: '0.8.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },

  contractSizer: {
    runOnCompile: true,
    disambiguatePaths: false
  },

  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.CMC_KEY
  }
}

export default config
