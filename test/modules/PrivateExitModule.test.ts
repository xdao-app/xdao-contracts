import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { constants } from "ethers"
import { parseEther } from "ethers/lib/utils"
import { ethers } from "hardhat"
import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  LP,
  LP__factory,
  NamedToken__factory,
  PrivateExitModule,
  PrivateExitModule__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
} from "../../typechain"
import { executeTx } from "../utils"

describe("PrivateExitModule", () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let dao: Dao

  let lp: LP

  let privateExitModule: PrivateExitModule

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

    privateExitModule = await new PrivateExitModule__factory(
      signers[0]
    ).deploy()

    await executeTx(
      dao.address,
      shop.address,
      "createLp",
      ["string", "string"],
      ["EgorLP", "ELP"],
      0,
      signers[0]
    )

    lp = LP__factory.connect(await dao.lp(), signers[0])
  })

  it("Create, Exit, Disable, Read", async () => {
    const friendAddress = await signers[1].getAddress()

    const usdc = await new NamedToken__factory(signers[0]).deploy(
      "USDC",
      "USDC"
    )

    const btc = await new NamedToken__factory(signers[0]).deploy("BTC", "BTC")

    await executeTx(
      dao.address,
      privateExitModule.address,
      "createPrivateExitOffer",
      ["address", "uint256", "uint256", "address[]", "uint256[]"],
      [
        friendAddress,
        parseEther("1"),
        parseEther("0.07"),
        [usdc.address, btc.address],
        [parseEther("0.9"), parseEther("1.3")],
      ],
      0,
      signers[0]
    )

    await expect(
      privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance")

    expect(await lp.totalSupply()).to.eql(constants.Zero)

    await executeTx(
      dao.address,
      shop.address,
      "createPrivateOffer",
      ["address", "address", "uint256", "uint256"],
      [friendAddress, usdc.address, 0, parseEther("2")],
      0,
      signers[0]
    )

    await shop.connect(signers[1]).buyPrivateOffer(dao.address, 0)

    expect(await lp.balanceOf(friendAddress))
      .to.eql(parseEther("2"))
      .to.eql(await lp.totalSupply())

    await expect(
      privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance")

    await lp
      .connect(signers[1])
      .approve(privateExitModule.address, parseEther("999"))

    await expect(
      privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.be.revertedWith("DAO: only for permitted")

    await executeTx(
      dao.address,
      dao.address,
      "addPermitted",
      ["address"],
      [privateExitModule.address],
      0,
      signers[0]
    )

    expect(await dao.containsPermitted(privateExitModule.address)).to.eq(true)

    await expect(
      privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance")

    await usdc.transfer(dao.address, parseEther("1"))
    await btc.transfer(dao.address, parseEther("2"))

    await expect(
      privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.be.revertedWith("Address: insufficient balance")

    await signers[0].sendTransaction({
      to: dao.address,
      value: parseEther("10"),
    })

    await executeTx(
      dao.address,
      lp.address,
      "changeBurnable",
      ["bool"],
      [false],
      0,
      signers[0]
    )

    await expect(
      await privateExitModule.connect(signers[1]).privateExit(dao.address, 0)
    ).to.changeEtherBalances(
      [dao, signers[1], privateExitModule],
      [parseEther("-0.07"), parseEther("0.07"), parseEther("0")]
    )

    expect(await ethers.provider.getBalance(privateExitModule.address)).to.eql(
      constants.Zero
    )

    expect(await ethers.provider.getBalance(dao.address)).to.eql(
      parseEther("9.93")
    )

    expect(await usdc.balanceOf(friendAddress)).to.eql(parseEther("0.9"))
    expect(await btc.balanceOf(friendAddress)).to.eql(parseEther("1.3"))

    // Create and Disable

    await executeTx(
      dao.address,
      privateExitModule.address,
      "createPrivateExitOffer",
      ["address", "uint256", "uint256", "address[]", "uint256[]"],
      [
        friendAddress,
        parseEther("1"),
        parseEther("0.07"),
        [usdc.address, btc.address],
        [parseEther("0.9"), parseEther("1.3")],
      ],
      0,
      signers[0]
    )

    expect(
      (await privateExitModule.privateExitOffers(dao.address, 1)).isActive
    ).to.eq(true)

    await executeTx(
      dao.address,
      privateExitModule.address,
      "disablePrivateExitOffer",
      ["uint256"],
      [1],
      0,
      signers[0]
    )

    expect(
      (await privateExitModule.privateExitOffers(dao.address, 1)).isActive
    ).to.eq(false)

    expect((await privateExitModule.getOffers(dao.address)).length).to.eq(2)
  })
})
