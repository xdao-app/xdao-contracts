import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import dayjs from "dayjs"
import { constants } from "ethers"
import { parseEther, verifyMessage } from "ethers/lib/utils"
import { ethers } from "hardhat"
import {
  Dao,
  DaoViewer__factory,
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

describe("Shop", () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let dao: Dao

  let signers: SignerWithAddress[]

  let ownerAddress: string

  let lp: LP

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
  })

  it("Public Offer", async () => {
    expect(await shop.publicOffers(dao.address)).to.have.property(
      "isActive",
      false
    )
    expect(await shop.publicOffers(dao.address)).to.have.property(
      "currency",
      constants.AddressZero
    )

    expect(+(await shop.publicOffers(dao.address)).rate).to.eq(0)

    const goldToken = await new Token__factory(signers[0]).deploy()

    const timestamp = dayjs().unix()

    let VOTING = {
      target: shop.address,
      data: createData(
        "initPublicOffer",
        ["bool", "address", "uint256"],
        [true, goldToken.address, parseEther("5")]
      ),
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

    await dao.execute(
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      [sig]
    )

    const daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    const investInfo = await daoViewer.getInvestInfo(factory.address)

    expect(investInfo[0][0].slice(0, 6)).to.eql([
      dao.address,
      await dao.name(),
      await dao.symbol(),
      lp.address,
      await lp.name(),
      await lp.symbol(),
    ])

    expect(investInfo[1][0].slice(0, 3)).to.eql([
      true,
      goldToken.address,
      parseEther("5"),
    ])

    expect(investInfo.slice(2)).to.eql([
      [await goldToken.symbol()],
      [await goldToken.decimals()],
      [constants.Zero],
    ])

    expect(await shop.publicOffers(dao.address)).to.have.property(
      "isActive",
      true
    )
    expect(await shop.publicOffers(dao.address)).to.have.property(
      "currency",
      goldToken.address
    )

    expect((await shop.publicOffers(dao.address)).rate).to.eql(parseEther("5"))

    await goldToken.transfer(await signers[1].getAddress(), parseEther("10"))

    await goldToken.connect(signers[1]).approve(shop.address, parseEther("10"))

    await shop.connect(signers[1]).buyPublicOffer(dao.address, parseEther("2"))

    expect(await goldToken.balanceOf(await signers[1].getAddress())).to.eq(0)

    expect(await lp.balanceOf(await signers[1].getAddress())).to.eq(
      parseEther("2")
    )
  })

  it("Create and Disable Private Offer", async () => {
    const timestamp = dayjs().unix()

    const friendAddress = await signers[1].getAddress()

    const goldToken = await new Token__factory(signers[0]).deploy()

    expect(await shop.numberOfPrivateOffers(dao.address)).to.eq(0)

    let VOTING = {
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

    await dao.execute(
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      [sig]
    )

    const daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    const privateOffersInfo = await daoViewer.getPrivateOffersInfo(
      factory.address
    )

    expect(privateOffersInfo[0][0].slice(0, 6)).to.eql([
      dao.address,
      await dao.name(),
      await dao.symbol(),
      lp.address,
      await lp.name(),
      await lp.symbol(),
    ])

    expect(privateOffersInfo.slice(1)).to.eql([
      [constants.One],
      [
        [
          true,
          friendAddress,
          goldToken.address,
          BigNumber.from("25"),
          BigNumber.from("15"),
        ],
      ],
      [await goldToken.symbol()],
      [await goldToken.decimals()],
    ])

    expect(await shop.numberOfPrivateOffers(dao.address)).to.eq(1)

    VOTING = {
      target: shop.address,
      data: createData("disablePrivateOffer", ["uint256"], [0]),
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

    await dao.execute(
      VOTING.target,
      VOTING.data,
      VOTING.value,
      VOTING.nonce,
      VOTING.timestamp,
      [sig]
    )

    await expect(
      shop.connect(signers[1]).buyPrivateOffer(dao.address, 0)
    ).to.be.revertedWith("Shop: this offer is disabled")

    expect(await shop.numberOfPrivateOffers(dao.address)).to.eq(1)
  })
})
