import { parseEther } from "@ethersproject/units"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import dayjs from "dayjs"
import { ethers } from "hardhat"
import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
} from "../../typechain"

describe("Factory", () => {
  let shop: Shop

  let factory: Factory

  let token: Token

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
  })

  it("Create DAO", async () => {
    expect(await factory.getDaos()).to.be.an("array").that.is.empty

    const DAO_CONFIG = {
      daoName: "EgorDAO",
      daoSymbol: "EDAO",
      quorum: 51,
      partners: [ownerAddress],
      shares: [10],
    }

    expect(
      await factory.create(
        DAO_CONFIG.daoName,
        DAO_CONFIG.daoSymbol,
        DAO_CONFIG.quorum,
        DAO_CONFIG.partners,
        DAO_CONFIG.shares
      )
    )
      .to.emit(factory, "DaoCreated")
      .withArgs(await factory.daoAt(0))

    expect(await factory.numberOfDaos()).to.eq(1)

    expect(await factory.getDaos())
      .to.be.an("array")
      .of.length(1)
  })

  it("Subscription", async () => {
    expect(await factory.monthlyCost()).to.eq(0)
    expect(await factory.freeTrial()).to.eq(0)
  })

  it("Change Subscription", async () => {
    await expect(
      factory.connect(signers[1]).changeMonthlyCost(1)
    ).to.be.revertedWith("Ownable: caller is not the owner")

    await expect(
      factory.connect(signers[1]).changeFreeTrial(1)
    ).to.be.revertedWith("Ownable: caller is not the owner")

    await factory.changeMonthlyCost(10)

    expect(await factory.monthlyCost()).to.eq(10)

    await factory.changeFreeTrial(15)

    expect(await factory.freeTrial()).to.eq(15)
  })

  it("Change Free Trial", async () => {
    expect(await factory.freeTrial()).to.eq(0)

    await factory.changeFreeTrial(86400)

    expect(await factory.freeTrial()).to.eq(86400)

    await factory.create("LongTrial", "LONGTRIAL", 100, [ownerAddress], [1])

    const timestamp = dayjs().unix()

    expect((await factory.subscriptions(await factory.daoAt(0))).toNumber())
      .to.lessThan(timestamp + 120 + 86400)
      .to.greaterThan(timestamp + 86400)
  })

  describe("With DAO", () => {
    let dao: Dao

    beforeEach(async () => {
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

    it("Pay Subscription", async () => {
      expect(await token.balanceOf(ownerAddress)).to.eq(parseEther("100"))

      await factory.transferOwnership(await signers[1].getAddress())

      let timestamp = dayjs().unix()

      expect((await factory.subscriptions(dao.address)).toNumber())
        .to.lessThanOrEqual(timestamp + 120)
        .to.greaterThanOrEqual(timestamp)

      await factory.connect(signers[1]).changeMonthlyCost(1)

      expect(await factory.monthlyCost()).to.eq(1)

      await token.approve(factory.address, 1)

      await factory.subscribe(dao.address)

      expect(await token.balanceOf(ownerAddress)).to.eq(
        parseEther("100").sub(1)
      )

      timestamp = dayjs().unix()

      expect((await factory.subscriptions(dao.address)).toNumber())
        .to.lessThanOrEqual(timestamp + 120 + 30 * 86400)
        .to.greaterThanOrEqual(timestamp + 30 * 86400)

      await factory.connect(signers[1]).changeMonthlyCost(parseEther("10"))

      expect(await factory.monthlyCost()).to.eq(parseEther("10"))

      await token.approve(factory.address, parseEther("13"))

      await factory.subscribe(dao.address)

      expect(await token.balanceOf(ownerAddress)).to.eq(parseEther("90").sub(1))

      timestamp = dayjs().unix()

      expect((await factory.subscriptions(dao.address)).toNumber())
        .to.lessThanOrEqual(timestamp + 120 + 2 * 30 * 86400)
        .to.greaterThanOrEqual(timestamp + 2 * 30 * 86400)
    })
  })
})
