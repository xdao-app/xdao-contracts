import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import dayjs from "dayjs"
import { constants } from "ethers"
import { verifyMessage } from "ethers/lib/utils"
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

    const [share1, totalSupply1, quorum1] = await daoViewer.getShare(
      await factory.daoAt(0),
      [ownerAddress]
    )

    expect([+share1, +totalSupply1, quorum1]).to.eql([10, 10, 51])

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
})
