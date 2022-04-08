import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import '@openzeppelin/hardhat-upgrades'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import 'hardhat-tracer'
import 'solidity-coverage'

import * as dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/config'

dotenv.config()

const vanityKey =
  '960fb429377453d0a1aec14807813d01f989cc5504270e514bf2a9f7d843253a'

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 15e6
    },

    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    bsc: {
      url: `https://bsc-dataseed.binance.org/`,
      chainId: 56,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    heco: {
      url: `https://http-mainnet.hecochain.com`,
      chainId: 128,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    opera: {
      url: `https://rpc.ftm.tools/`,
      chainId: 250,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    optimisticEthereum: {
      url: `https://mainnet.optimism.io`,
      chainId: 10,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    polygon: {
      url: `https://polygon-rpc.com`,
      chainId: 137,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey],
      gasPrice: 40000000000
    },

    avalanche: {
      url: `https://api.avax.network/ext/bc/C/rpc`,
      chainId: 43114,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
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

    boba: {
      url: `https://mainnet.boba.network`,
      chainId: 288,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    moonbeam: {
      url: 'https://rpc.api.moonbeam.network',
      chainId: 1284,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    moonriver: {
      url: 'https://rpc.api.moonriver.moonbeam.network',
      chainId: 1285,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    astar: {
      url: 'https://rpc.astar.network:8545',
      chainId: 592,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    shiden: {
      url: 'https://evm.shiden.astar.network',
      chainId: 336,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    fuse: {
      url: 'https://rpc.fuse.io',
      chainId: 122,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey]
    },

    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
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
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY,
      rinkeby: process.env.ETHERSCAN_KEY,
      bsc: process.env.BSCSCAN_KEY,
      heco: process.env.HECOINFO_KEY,
      opera: process.env.FTMSCAN_KEY,
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_KEY,
      polygon: process.env.POLYGONSCAN_KEY,
      avalanche: process.env.SNOWTRACE_KEY,
      moonbeam: process.env.MOONBEAM_KEY,
      moonriver: process.env.MOONRIVER_KEY,
      aurora: process.env.AURORA_KEY
    }
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
