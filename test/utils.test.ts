import { expect } from "chai"
import dayjs from "dayjs"
import { AbiCoder, id, verifyMessage } from "ethers/lib/utils"
import { ethers } from "hardhat"
import { createData, createTxHash } from "./utils"

describe("Utils", () => {
  it("Create Data without Args", () => {
    expect(createData("toggle"))
      .to.eq(id("toggle()").slice(0, 10))
      .to.eq("0x40a3d246")
  })

  it("Create Data with Args", () => {
    expect(
      createData(
        "transfer",
        ["address", "uint256"],
        ["0x000000000000000000000000000000000000dEaD", "100"]
      )
    )
      .to.eq(
        id("transfer(address,uint256)").slice(0, 10) +
          new AbiCoder()
            .encode(
              ["address", "uint256"],
              ["0x000000000000000000000000000000000000dEaD", "100"]
            )
            .slice(2)
      )
      .to.eq(
        "0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000000064"
      )
  })

  it("Create Tx Hash without Args", async () => {
    const signer = (await ethers.getSigners())[0]

    const daoAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

    const targetAddress = "0xe592427a0aece92de3edee1f18e0157c05861564"

    const txHash = createTxHash(
      daoAddress,
      targetAddress,
      createData("toggle"),
      12,
      27,
      dayjs().unix(),
      1337
    )

    const sig = await signer.signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(await signer.getAddress())
  })

  it("Create Tx Hash with Args", async () => {
    const signer = (await ethers.getSigners())[0]

    const daoAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

    const targetAddress = "0xe592427a0aece92de3edee1f18e0157c05861564"

    const txHash = createTxHash(
      daoAddress,
      targetAddress,
      createData(
        "transfer",
        ["address", "uint256"],
        ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 100]
      ),
      12,
      27,
      dayjs().unix(),
      1337
    )

    const sig = await signer.signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(await signer.getAddress())
  })
})
