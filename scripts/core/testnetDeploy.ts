import * as dotenv from "dotenv"
import { ethers, run } from "hardhat"
import {
  DaoViewer__factory,
  Factory__factory,
  Shop__factory,
  XDAO__factory,
} from "../../typechain"

dotenv.config()

async function main() {
  const signers = await ethers.getSigners()

  const shop = await new Shop__factory(signers[0]).deploy()

  await shop.deployed()

  console.log("Shop:", shop.address)

  const xdaoToken = await new XDAO__factory(signers[0]).deploy()

  await xdaoToken.deployed()

  console.log("XDAO Token:", xdaoToken.address)

  const factory = await new Factory__factory(signers[0]).deploy(
    shop.address,
    xdaoToken.address
  )

  await factory.deployed()

  console.log("Factory:", factory.address)

  console.log("Setting Factory Address to Shop")

  const tx = await shop.setFactory(factory.address)

  await tx.wait()

  console.log("Success: Setting Factory Address to Shop")

  const daoViewer = await new DaoViewer__factory(signers[0]).deploy()

  await daoViewer.deployed()

  console.log("Dao Viewer:", daoViewer.address)

  try {
    await run("verify:verify", {
      address: shop.address,
      contract: "contracts/core/Shop.sol:Shop",
    })
  } catch {
    console.log("Verification problem (Shop)")
  }

  try {
    await run("verify:verify", {
      address: xdaoToken.address,
      contract: "contracts/core/XDAO.sol:XDAO",
    })
  } catch {
    console.log("Verification problem (XDAO Token)")
  }

  try {
    await run("verify:verify", {
      address: factory.address,
      constructorArguments: [shop.address, xdaoToken.address],
      contract: "contracts/core/Factory.sol:Factory",
    })
  } catch {
    console.log("Verification problem (Factory)")
  }

  try {
    await run("verify:verify", {
      address: daoViewer.address,
      contract: "contracts/viewers/DaoViewer.sol:DaoViewer",
    })
  } catch {
    console.log("Verification problem (DaoViewer)")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
