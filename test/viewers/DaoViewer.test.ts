import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import dayjs from "dayjs"
import { constants } from "ethers"
import { parseEther, verifyMessage } from "ethers/lib/utils"
import { ethers } from "hardhat"
import {
  DaoViewer,
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

describe("DaoViewer", () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let signers: SignerWithAddress[]

  let ownerAddress: string

  let lp: LP

  let daoViewer: DaoViewer

  it("Works Properly", async () => {
    signers = await ethers.getSigners()

    ownerAddress = await signers[0].getAddress()

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    expect(await daoViewer.getDaos(factory.address)).to.be.an("array").that.is
      .empty

    expect(await daoViewer.userDaos(ownerAddress, factory.address)).to.be.an(
      "array"
    ).that.is.empty

    await factory.create("FIRST", "FIRST", 51, [ownerAddress], [10])

    const [share0, totalSupply0, quorum0] = await daoViewer.getShare(
      await factory.daoAt(0),
      []
    )

    expect([+share0, +totalSupply0, quorum0]).to.eql([0, 10, 51])

    const [shares00, totalSupply00, quorum00] = await daoViewer.getShares(
      await factory.daoAt(0),
      [[]]
    )

    expect([shares00, +totalSupply00, quorum00]).to.eql([
      [constants.Zero],
      10,
      51,
    ])

    const [share1, totalSupply1, quorum1] = await daoViewer.getShare(
      await factory.daoAt(0),
      [ownerAddress]
    )

    expect([+share1, +totalSupply1, quorum1]).to.eql([10, 10, 51])

    const [shares11, totalSupply11, quorum11] = await daoViewer.getShares(
      await factory.daoAt(0),
      [[ownerAddress], [], [], [ownerAddress, await signers[1].getAddress()]]
    )

    expect([shares11, +totalSupply11, quorum11]).to.eql([
      [BigNumber.from(10), constants.Zero, constants.Zero, BigNumber.from(10)],
      10,
      51,
    ])

    expect(await daoViewer.getDaos(factory.address)).to.have.lengthOf(1)

    expect((await daoViewer.getDao(await factory.daoAt(0))).dao).to.eq(
      await factory.daoAt(0)
    )
    expect((await daoViewer.getDao(await factory.daoAt(0))).daoName).to.eq(
      "FIRST"
    )
    expect((await daoViewer.getDao(await factory.daoAt(0))).daoSymbol).to.eq(
      "FIRST"
    )
    expect((await daoViewer.getDao(await factory.daoAt(0))).lp).to.eq(
      constants.AddressZero
    )
    expect((await daoViewer.getDao(await factory.daoAt(0))).lpName).to.eq("")
    expect((await daoViewer.getDao(await factory.daoAt(0))).lpSymbol).to.eq("")

    await factory.create("SECOND", "SECOND", 61, [ownerAddress], [20])

    expect(await daoViewer.getDaos(factory.address)).to.have.lengthOf(2)

    expect((await daoViewer.getDao(await factory.daoAt(1))).dao).to.eq(
      await factory.daoAt(1)
    )
    expect((await daoViewer.getDao(await factory.daoAt(1))).daoName).to.eq(
      "SECOND"
    )
    expect((await daoViewer.getDao(await factory.daoAt(1))).daoSymbol).to.eq(
      "SECOND"
    )
    expect((await daoViewer.getDao(await factory.daoAt(1))).lp).to.eq(
      constants.AddressZero
    )
    expect((await daoViewer.getDao(await factory.daoAt(1))).lpName).to.eq("")
    expect((await daoViewer.getDao(await factory.daoAt(1))).lpSymbol).to.eq("")

    await factory.create("THIRD", "THIRD", 71, [ownerAddress], [30])

    expect(await daoViewer.getDaos(factory.address)).to.have.lengthOf(3)

    expect((await daoViewer.getDao(await factory.daoAt(2))).dao).to.eq(
      await factory.daoAt(2)
    )
    expect((await daoViewer.getDao(await factory.daoAt(2))).daoName).to.eq(
      "THIRD"
    )
    expect((await daoViewer.getDao(await factory.daoAt(2))).daoSymbol).to.eq(
      "THIRD"
    )
    expect((await daoViewer.getDao(await factory.daoAt(2))).lp).to.eq(
      constants.AddressZero
    )
    expect((await daoViewer.getDao(await factory.daoAt(2))).lpName).to.eq("")

    expect((await daoViewer.getDao(await factory.daoAt(2))).lpSymbol).to.eq("")

    const firstDao = Dao__factory.connect(await factory.daoAt(0), signers[0])

    expect(await firstDao.lp()).to.eq(constants.AddressZero)

    const timestamp = dayjs().unix()

    let VOTING = {
      target: shop.address,
      data: createData("createLp", ["string", "string"], ["FirstLP", "FLP"]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    let txHash = createTxHash(
      firstDao.address,
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
      await firstDao.execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    ).to.emit(shop, "LpCreated")

    expect(await firstDao.lp()).to.not.eq(constants.AddressZero)

    lp = LP__factory.connect(await firstDao.lp(), signers[0])

    expect(await shop.lps(lp.address)).to.eq(true)

    expect((await daoViewer.getDao(firstDao.address)).lp).to.eq(lp.address)
    expect((await daoViewer.getDao(await factory.daoAt(0))).lpName).to.eq(
      "FirstLP"
    )
    expect((await daoViewer.getDao(await factory.daoAt(0))).lpSymbol).to.eq(
      "FLP"
    )

    expect(
      await daoViewer.userDaos(ownerAddress, factory.address)
    ).to.have.lengthOf(3)
  })

  it("Balance Checker", async () => {
    const signers = await ethers.getSigners()
    const gold = await new Token__factory(signers[0]).deploy()
    const silver = await new Token__factory(signers[0]).deploy()
    const bronze = await new Token__factory(signers[0]).deploy()

    const owner = await signers[0].getAddress()
    const friend = await signers[1].getAddress()

    await gold.transfer(friend, parseEther("1"))
    await silver.transfer(friend, parseEther("2"))
    await bronze.transfer(friend, parseEther("3"))

    expect(await gold.balanceOf(owner)).to.eql(parseEther("99"))
    expect(await silver.balanceOf(owner)).to.eql(parseEther("98"))
    expect(await bronze.balanceOf(owner)).to.eql(parseEther("97"))

    expect(await gold.balanceOf(friend)).to.eql(parseEther("1"))
    expect(await silver.balanceOf(friend)).to.eql(parseEther("2"))
    expect(await bronze.balanceOf(friend)).to.eql(parseEther("3"))

    const daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    expect(
      await daoViewer.balances(
        [owner, friend],
        [gold.address, silver.address, bronze.address]
      )
    ).to.eql([
      parseEther("99"),
      parseEther("98"),
      parseEther("97"),
      parseEther("1"),
      parseEther("2"),
      parseEther("3"),
    ])

    const [firstReceiver, secondReceiver, thirdReceiver] = [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ]

    await signers[0].sendTransaction({
      to: firstReceiver,
      value: parseEther("123.45"),
    })

    await signers[0].sendTransaction({
      to: secondReceiver,
      value: parseEther("0.777"),
    })

    await signers[0].sendTransaction({
      to: thirdReceiver,
      value: parseEther("1.23"),
    })

    expect(
      await daoViewer.balances(
        [firstReceiver, secondReceiver, thirdReceiver],
        [constants.AddressZero]
      )
    ).to.eql([parseEther("123.45"), parseEther("0.777"), parseEther("1.23")])
  })

  it("Get Hash Statuses", async () => {
    signers = await ethers.getSigners()

    ownerAddress = await signers[0].getAddress()

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    await factory.create("FIRST", "FIRST", 51, [ownerAddress], [10])

    const dao = Dao__factory.connect(await factory.daoAt(0), signers[0])

    const timestamp1 = dayjs().unix()

    const VOTING_1 = {
      target: dao.address,
      data: createData("changeQuorum", ["uint8"], [60]),
      value: 0,
      nonce: 0,
      timestamp: timestamp1,
    }

    const txHash1 = createTxHash(
      dao.address,
      VOTING_1.target,
      VOTING_1.data,
      VOTING_1.value,
      VOTING_1.nonce,
      VOTING_1.timestamp,
      1337
    )

    expect(await daoViewer.getHashStatuses(dao.address, [txHash1])).to.eql([
      false,
    ])

    await dao.execute(
      VOTING_1.target,
      VOTING_1.data,
      VOTING_1.value,
      VOTING_1.nonce,
      VOTING_1.timestamp,
      [await signers[0].signMessage(txHash1)]
    )

    expect(await daoViewer.getHashStatuses(dao.address, [txHash1])).to.eql([
      true,
    ])

    const txHash2 = createTxHash(
      dao.address,
      VOTING_1.target,
      VOTING_1.data,
      VOTING_1.value,
      VOTING_1.nonce,
      VOTING_1.timestamp + 20,
      1337
    )

    expect(
      await daoViewer.getHashStatuses(dao.address, [txHash1, txHash2])
    ).to.eql([true, false])

    expect(
      await daoViewer.getHashStatuses(dao.address, [txHash2, txHash1])
    ).to.eql([false, true])

    await dao.execute(
      VOTING_1.target,
      VOTING_1.data,
      VOTING_1.value,
      VOTING_1.nonce,
      VOTING_1.timestamp + 20,
      [await signers[0].signMessage(txHash2)]
    )

    expect(
      await daoViewer.getHashStatuses(dao.address, [txHash1, txHash2])
    ).to.eql([true, true])
  })

  it("Get DAO Configuration, Invest Info and Private Offers", async () => {
    signers = await ethers.getSigners()

    ownerAddress = await signers[0].getAddress()

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    expect(await daoViewer.getInvestInfo(factory.address)).to.eql([
      [],
      [],
      [],
      [],
      [],
    ])
    expect(await daoViewer.getPrivateOffersInfo(factory.address)).to.eql([
      [],
      [],
      [],
      [],
      [],
    ])

    await factory.create("FIRST", "FIRST", 51, [ownerAddress], [10])

    expect(
      (
        await daoViewer.getDaoConfiguration(
          factory.address,
          await factory.daoAt(0)
        )
      ).slice(0, 11)
    ).to.eql([
      true,
      true,
      constants.AddressZero,
      false,
      false,
      false,
      false,
      constants.Zero,
      constants.Zero,
      constants.Zero,
      constants.Zero,
    ])

    const investInfo = await daoViewer.getInvestInfo(factory.address)

    expect(investInfo[0][0].slice(0, 6)).to.eql([
      await factory.daoAt(0),
      "FIRST",
      "FIRST",
      constants.AddressZero,
      "",
      "",
    ])

    expect(investInfo[1][0].slice(0, 3)).to.eql([
      false,
      constants.AddressZero,
      constants.Zero,
    ])

    expect(investInfo.slice(2)).to.eql([[""], [0], [constants.Zero]])

    const privateOffersInfo = await daoViewer.getPrivateOffersInfo(
      factory.address
    )

    expect(privateOffersInfo[0][0].slice(0, 6)).to.eql([
      await factory.daoAt(0),
      "FIRST",
      "FIRST",
      constants.AddressZero,
      "",
      "",
    ])

    expect(privateOffersInfo.slice(1)).to.eql([[constants.Zero], [], [], []])

    const timestamp = dayjs().unix()

    let VOTING = {
      target: shop.address,
      data: createData("createLp", ["string", "string"], ["FirstLP", "FLP"]),
      value: 0,
      nonce: 0,
      timestamp,
    }

    let txHash = createTxHash(
      await factory.daoAt(0),
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
      await Dao__factory.connect(await factory.daoAt(0), signers[0]).execute(
        VOTING.target,
        VOTING.data,
        VOTING.value,
        VOTING.nonce,
        VOTING.timestamp,
        [sig]
      )
    ).to.emit(shop, "LpCreated")

    expect(
      (
        await daoViewer.getDaoConfiguration(
          factory.address,
          await factory.daoAt(0)
        )
      ).slice(0, 11)
    ).to.eql([
      true,
      true,
      await Dao__factory.connect(await factory.daoAt(0), signers[0]).lp(),
      true,
      true,
      false,
      false,
      constants.Zero,
      constants.Zero,
      constants.Zero,
      constants.Zero,
    ])
  })
})
