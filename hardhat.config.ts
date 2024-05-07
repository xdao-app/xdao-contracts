import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-waffle'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import 'dotenv/config'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import 'hardhat-tracer'
import 'solidity-coverage'

import { HardhatUserConfig } from 'hardhat/config'

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 15e6
    },

    mainnet: {
      url: `https://rpc.ankr.com/eth`,
      chainId: 1,
      accounts
    },

    bsc: {
      url: `https://rpc.ankr.com/bsc`,
      chainId: 56,
      accounts
    },

    heco: {
      url: `https://http-mainnet.hecochain.com`,
      chainId: 128,
      accounts
    },

    opera: {
      url: `https://rpc.ftm.tools/`,
      chainId: 250,
      accounts
    },

    optimisticEthereum: {
      url: `https://mainnet.optimism.io`,
      chainId: 10,
      accounts
    },

    polygon: {
      url: `https://polygon.llamarpc.com`,
      chainId: 137,
      accounts
    },

    avalanche: {
      url: `https://api.avax.network/ext/bc/C/rpc`,
      chainId: 43114,
      accounts
    },

    celo: {
      url: `https://forno.celo.org`,
      chainId: 42220,
      accounts
    },

    oec: {
      url: `https://exchainrpc.okex.org`,
      chainId: 66,
      accounts
    },

    metis: {
      url: `https://andromeda.metis.io/?owner=1088`,
      chainId: 1088,
      accounts
    },

    aurora: {
      url: `https://mainnet.aurora.dev`,
      chainId: 1313161554,
      accounts
    },

    boba: {
      url: `https://mainnet.boba.network`,
      chainId: 288,
      accounts
    },

    moonbeam: {
      url: 'https://rpc.api.moonbeam.network',
      chainId: 1284,
      accounts
    },

    moonriver: {
      url: 'https://rpc.api.moonriver.moonbeam.network',
      chainId: 1285,
      accounts
    },

    astar: {
      url: 'https://astar.public.blastapi.io',
      chainId: 592,
      accounts
    },

    shiden: {
      url: 'https://evm.shiden.astar.network',
      chainId: 336,
      accounts
    },

    fuse: {
      url: 'https://rpc.fuse.io',
      chainId: 122,
      accounts
    },

    xinfin: {
      url: 'https://rpc.xinfin.network',
      chainId: 50,
      accounts
    },

    bttc: {
      url: 'https://rpc.bt.io',
      chainId: 199,
      accounts
    },

    oasis: {
      url: 'https://emerald.oasis.dev',
      chainId: 42262,
      accounts
    },

    coinex: {
      url: 'https://rpc.coinex.net',
      chainId: 52,
      accounts
    },

    klaytn: {
      url: 'https://public-node-api.klaytnapi.com/v1/cypress',
      chainId: 8217,
      accounts
    },

    milkomeda: {
      url: 'https://rpc-mainnet-cardano-evm.c1.milkomeda.com',
      chainId: 2001,
      accounts
    },

    cube: {
      url: 'https://http-mainnet.cube.network',
      chainId: 1818,
      accounts
    },

    ontology: {
      url: 'https://dappnode3.ont.io:10339',
      chainId: 58,
      accounts
    },

    telos: {
      url: 'https://mainnet.telos.net/evm',
      chainId: 40,
      accounts
    },

    godwoken: {
      url: 'https://v1.mainnet.godwoken.io/rpc',
      chainId: 71402,
      accounts
    },

    evmos: {
      url: 'https://eth.bd.evmos.org:8545',
      chainId: 9001,
      accounts
    },

    arbitrumOne: {
      url: 'https://arb1.arbitrum.io/rpc',
      chainId: 42161,
      accounts
    },

    skale: {
      url: 'https://mainnet.skalenodes.com/v1/parallel-stormy-spica',
      chainId: 1350216234,
      accounts
    },

    neonDevnet: {
      url: 'https://proxy.devnet.neonlabs.org/solana',
      chainId: 245022926,
      accounts
    },

    base: {
      url: 'https://developer-access-mainnet.base.org',
      chainId: 8453,
      accounts,
      gasPrice: 0.13e9
    },

    mantle: {
      url: 'https://rpc.mantle.xyz',
      chainId: 5000,
      accounts
    },

    zetaTest: {
      url: 'https://zetachain-athens-evm.blockpi.network/v1/rpc/public',
      chainId: 7001,
      accounts
    },

    opbnb: {
      url: 'https://opbnb-mainnet-rpc.bnbchain.org',
      chainId: 204,
      accounts,
      gasPrice: 1e9
    },

    arbitrumNova: {
      url: 'https://nova.arbitrum.io/rpc',
      chainId: 42170,
      accounts
    },

    core: {
      url: 'https://rpc.coredao.org',
      chainId: 1116,
      accounts
    },

    manta: {
      url: 'https://manta-pacific.drpc.org',
      chainId: 169,
      accounts
    },

    blast: {
      url: 'https://rpc.blast.io',
      chainId: 81457,
      accounts
    },

    mode: {
      url: 'https://mainnet.mode.network',
      chainId: 34443,
      accounts
    },

    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 4,
      accounts
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
      aurora: process.env.AURORA_KEY,
      arbitrumOne: process.env.ARBISCAN_KEY
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
