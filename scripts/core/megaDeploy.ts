import { BigNumberish } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import dayjs from "dayjs"
import * as dotenv from "dotenv"
import { parseEther } from "ethers/lib/utils"
import { ethers, network } from "hardhat"
import { createData, createTxHash } from "../../test/utils"
import {
  DaoViewer__factory,
  Dao__factory,
  Factory__factory,
  NamedToken__factory,
  Shop__factory,
  XDAO__factory,
} from "../../typechain"

dotenv.config()

async function execute(
  daoAddress: string,
  targetAddress: string,
  data: string,
  value: BigNumberish,
  nonce: BigNumberish,
  signer: SignerWithAddress
) {
  const timestamp = dayjs().unix()

  await Dao__factory.connect(daoAddress, signer).execute(
    targetAddress,
    data,
    value,
    nonce,
    timestamp,
    [
      await signer.signMessage(
        createTxHash(daoAddress, targetAddress, data, 0, 0, timestamp, 1337)
      ),
    ]
  )
}

async function main() {
  await network.provider.request({ method: "hardhat_reset", params: [] })

  const signers = await ethers.getSigners()

  const shop = await new Shop__factory(signers[0]).deploy()

  console.log("Shop:", shop.address)

  const xdaoToken = await new XDAO__factory(signers[0]).deploy()

  console.log("XDAO Token:", xdaoToken.address)

  const factory = await new Factory__factory(signers[0]).deploy(
    shop.address,
    xdaoToken.address
  )

  console.log("Factory:", factory.address)

  console.log("Setting Factory Address to Shop")

  await shop.setFactory(factory.address)

  console.log("Success: Setting Factory Address to Shop")

  const daoViewer = await new DaoViewer__factory(signers[0]).deploy()

  console.log("Dao Viewer:", daoViewer.address)

  await factory.create(
    "AloneDAO",
    "ALONE",
    51,
    [await signers[0].getAddress()],
    [parseEther("10")]
  )

  await factory.create(
    "FriendsDAO",
    "FRIENDS",
    51,
    [await signers[0].getAddress(), await signers[1].getAddress()],
    [parseEther("10"), parseEther("10")]
  )

  await factory.create(
    "WithLP",
    "WITHLP",
    51,
    [await signers[0].getAddress()],
    [parseEther("10")]
  )

  await factory.create(
    "PrivateDAO",
    "PRIVATE",
    51,
    [await signers[0].getAddress()],
    [parseEther("10")]
  )

  await factory.create(
    "PublicDAO",
    "PUBLIC",
    51,
    [await signers[0].getAddress()],
    [parseEther("10")]
  )

  await factory.create(
    "ComplexDAO",
    "COMPLEX",
    51,
    [await signers[0].getAddress()],
    [parseEther("10")]
  )

  console.log("Deployed 6 DAOs")

  const usdc = await new NamedToken__factory(signers[0]).deploy("USDC", "USDC")

  console.log("USDC Token:", usdc.address)

  const btc = await new NamedToken__factory(signers[0]).deploy("BTC", "BTC")

  console.log("BTC Token:", btc.address)

  const sol = await new NamedToken__factory(signers[0]).deploy("SOL", "SOL")

  console.log("SOL Token:", sol.address)

  for (const i of [2, 3, 4, 5]) {
    await execute(
      await factory.daoAt(i),
      shop.address,
      createData("createLp", ["string", "string"], ["LP", "LP"]),
      0,
      0,
      signers[0]
    )
  }

  for (const i of [3, 5]) {
    await execute(
      await factory.daoAt(i),
      shop.address,
      createData(
        "createPrivateOffer",
        ["address", "address", "uint256", "uint256"],
        [
          await signers[0].getAddress(),
          [usdc, btc, sol][i - 3].address,
          parseEther("1.6"),
          parseEther("3.5"),
        ]
      ),
      0,
      0,
      signers[0]
    )

    await execute(
      await factory.daoAt(i),
      shop.address,
      createData(
        "createPrivateOffer",
        ["address", "address", "uint256", "uint256"],
        [
          await signers[1].getAddress(),
          [usdc, btc, sol][5 - i].address,
          parseEther("1.7"),
          parseEther("3.9"),
        ]
      ),
      0,
      0,
      signers[0]
    )

    await execute(
      await factory.daoAt(i),
      shop.address,
      createData(
        "createPrivateOffer",
        ["address", "address", "uint256", "uint256"],
        [
          await signers[0].getAddress(),
          [usdc, btc, sol][5 - i].address,
          parseEther("2.6"),
          parseEther("4.2"),
        ]
      ),
      0,
      0,
      signers[0]
    )

    await execute(
      await factory.daoAt(i),
      shop.address,
      createData("disablePrivateOffer", ["uint256"], [2]),
      0,
      0,
      signers[0]
    )
  }

  for (const i of [4, 5]) {
    await execute(
      await factory.daoAt(i),
      shop.address,
      createData(
        "initPublicOffer",
        ["bool", "address", "uint256"],
        ["true", [usdc, btc, sol][i - 4].address, parseEther("1.5")]
      ),
      0,
      0,
      signers[0]
    )
  }

  console.log("Done")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
