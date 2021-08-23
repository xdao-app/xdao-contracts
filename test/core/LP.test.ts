import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import dayjs from "dayjs"
import { constants } from "ethers"
import { parseEther, verifyMessage } from "ethers/lib/utils"
import { ethers } from "hardhat"
import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  LP,
  LP__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
} from "../../typechain"
import { createData, createTxHash } from "../utils"

describe("LP", () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let dao: Dao

  let lp: LP

  let signers: SignerWithAddress[]

  let ownerAddress: string

  beforeEach(async () => {
    signers = await ethers.getSigners()

    ownerAddress = await signers[0].getAddress()

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    const DAO_CONFIG = {
      daoName: "EgorDAO",
      daoSymbol: "EDAO",
      quorum: 51,
      partners: [ownerAddress],
      shares: [10],
    }

    await factory.create(
      DAO_CONFIG.daoName,
      DAO_CONFIG.daoSymbol,
      DAO_CONFIG.quorum,
      DAO_CONFIG.partners,
      DAO_CONFIG.shares
    )

    dao = Dao__factory.connect(await factory.daoAt(0), signers[0])
  })

  it("Deploy LP, Change Mintable/Burnable and Freeze Them", async () => {
    expect(await dao.lp()).to.eq(constants.AddressZero)

    const timestamp = dayjs().unix()

    let VOTING = {
      target: shop.address,
      data: createData("createLp", ["string", "string"], ["EgorLP", "ELP"]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    let txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    let sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    ).to.emit(shop, "LpCreated")

    expect(await dao.lp()).to.not.eq(constants.AddressZero)

    lp = LP__factory.connect(await dao.lp(), signers[0])

    expect(await shop.lps(lp.address)).to.eq(true)

    expect(
      await Promise.all([
        lp.name(),
        lp.symbol(),
        lp.totalSupply(),
        lp.mintable(),
        lp.burnable(),
        lp.mintableStatusFrozen(),
        lp.burnableStatusFrozen(),
        lp.dao(),
        lp.shop(),
      ])
    ).to.deep.eq([
      "EgorLP",
      "ELP",
      constants.Zero,
      true,
      true,
      false,
      false,
      dao.address,
      shop.address,
    ])

    VOTING = {
      target: lp.address,
      data: createData("changeMintable", ["bool"], [false]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    expect(await lp.mintable()).to.eq(false)

    VOTING = {
      target: lp.address,
      data: createData("changeBurnable", ["bool"], [false]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    expect(await lp.burnable()).to.eq(false)

    VOTING = {
      target: lp.address,
      data: createData("freezeMintingStatus"),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    expect(await lp.mintableStatusFrozen()).to.eq(true)

    VOTING = {
      target: lp.address,
      data: createData("freezeBurningStatus"),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    expect(await lp.burnableStatusFrozen()).to.eq(true)
  })

  it("Mint LP with Shop, then Burn", async () => {
    expect(await dao.lp()).to.eq(constants.AddressZero)

    const timestamp = dayjs().unix()

    const friendAddress = await signers[1].getAddress()

    let VOTING = {
      target: shop.address,
      data: createData("createLp", ["string", "string"], ["EgorLP", "ELP"]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    let txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    let sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    ).to.emit(shop, "LpCreated")

    lp = LP__factory.connect(await dao.lp(), signers[0])

    const goldToken = await new Token__factory(signers[0]).deploy()
    const silverToken = await new Token__factory(signers[0]).deploy()

    VOTING = {
      target: shop.address,
      data: createData(
        "createPrivateOffer",
        ["address", "address", "uint256", "uint256"],
        [friendAddress, goldToken.address, 25, 15]
      ),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    await goldToken.transfer(friendAddress, 30)

    await goldToken.connect(signers[1]).approve(shop.address, 25)

    await shop.connect(signers[1]).buyPrivateOffer(dao.address, 0)

    expect(
      (
        await Promise.all([
          lp.balanceOf(ownerAddress),
          lp.balanceOf(friendAddress),
          lp.balanceOf(dao.address),
          goldToken.balanceOf(ownerAddress),
          goldToken.balanceOf(friendAddress),
          goldToken.balanceOf(dao.address),
        ])
      ).map(Number)
    ).to.deep.eq([0, 15, 0, 1e20 - 30, 5, 25])

    VOTING = {
      target: shop.address,
      data: createData(
        "createPrivateOffer",
        ["address", "address", "uint256", "uint256"],
        [ownerAddress, silverToken.address, 15, 10]
      ),
      value: 0,
      nonce: 0,
      timestamp,
    }

    txHash = createTxHash(
      dao.address,
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      1337
    )

    sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    expect(
      await dao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    )

    await silverToken.approve(shop.address, 15)

    await shop.buyPrivateOffer(dao.address, 1)

    expect(
      (
        await Promise.all([
          lp.balanceOf(ownerAddress),
          lp.balanceOf(friendAddress),
          lp.balanceOf(dao.address),
          goldToken.balanceOf(ownerAddress),
          goldToken.balanceOf(friendAddress),
          goldToken.balanceOf(dao.address),
          silverToken.balanceOf(ownerAddress),
          silverToken.balanceOf(friendAddress),
          silverToken.balanceOf(dao.address),
        ])
      ).map(Number)
    ).to.deep.eq([10, 15, 0, 1e20 - 30, 5, 25, 1e20 - 15, 0, 15])

    await signers[0].sendTransaction({
      to: dao.address,
      value: parseEther("0.05"),
    })

    expect(await ethers.provider.getBalance(dao.address)).to.eq(
      parseEther("0.05")
    )

    await expect(
      await lp
        .connect(signers[1])
        .burn(15, [goldToken.address, silverToken.address], [], [])
    ).to.changeEtherBalances(
      [dao, signers[1]],
      [
        parseEther("-0.05").mul("15").div("25"),
        parseEther("0.05").mul("15").div("25"),
      ]
    )

    expect(
      (
        await Promise.all([
          lp.balanceOf(ownerAddress),
          lp.balanceOf(friendAddress),
          lp.balanceOf(dao.address),
          goldToken.balanceOf(ownerAddress),
          goldToken.balanceOf(friendAddress),
          goldToken.balanceOf(dao.address),
          silverToken.balanceOf(ownerAddress),
          silverToken.balanceOf(friendAddress),
          silverToken.balanceOf(dao.address),
        ])
      ).map(Number)
    ).to.deep.eq([
      10,
      0,
      0,
      1e20 - 30,
      5 + (25 * 15) / 25,
      (25 * 10) / 25,
      1e20 - 15,
      (15 * 15) / 25,
      (15 * 10) / 25,
    ])
  })
})
