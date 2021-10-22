import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-solhint"
import "@nomiclabs/hardhat-waffle"
import "@typechain/hardhat"
import * as dotenv from "dotenv"
import "hardhat-abi-exporter"
import "hardhat-contract-sizer"
import "hardhat-gas-reporter"
import "hardhat-tracer"
import { HardhatUserConfig, task } from "hardhat/config"
import "solidity-coverage"
dotenv.config()

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

const vanityKey =
  "960fb429377453d0a1aec14807813d01f989cc5504270e514bf2a9f7d843253a"

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 15e6,
    },

    mainnet: {
      url: `https://eth.getblock.io/?api_key=${process.env.GETBLOCK_KEY}}`,
      chainId: 1,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey],
    },

    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 4,
      accounts: [(process.env.PRIVATE_KEY as string) || vanityKey],
    },
  },

  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },

  contractSizer: {
    runOnCompile: true,
    disambiguatePaths: false,
  },

  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.CMC_KEY,
  },
}

export default config
