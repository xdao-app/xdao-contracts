import { parseEther } from "@ethersproject/units"
import { expect } from "chai"
import { ethers } from "hardhat"
import { XDAOPeg__factory } from "../../typechain"

describe("XDAOPeg", () => {
  it("Mint & Burn", async () => {
    const signers = await ethers.getSigners()

    const [owner, friend] = await Promise.all([
      signers[0].getAddress(),
      signers[1].getAddress(),
    ])

    const xdaoPeg = await new XDAOPeg__factory(signers[0]).deploy()

    expect(await xdaoPeg.balanceOf(owner))
      .to.eql(await xdaoPeg.balanceOf(friend))
      .to.eql(await xdaoPeg.totalSupply())
      .to.eql(ethers.constants.Zero)

    await xdaoPeg.mint(owner, parseEther("1.23"))

    expect(await xdaoPeg.balanceOf(owner))
      .to.eql(await xdaoPeg.totalSupply())
      .to.eql(parseEther("1.23"))

    await xdaoPeg.mint(friend, parseEther("2.34"))

    expect(await xdaoPeg.balanceOf(friend))
      .to.eql((await xdaoPeg.totalSupply()).sub(parseEther("1.23")))
      .to.eql(parseEther("2.34"))

    await expect(
      xdaoPeg.connect(signers[1]).mint(owner, parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner")

    await xdaoPeg.burn(parseEther("0.12"))

    expect(await xdaoPeg.balanceOf(owner))
      .to.eql((await xdaoPeg.totalSupply()).sub(parseEther("2.34")))
      .to.eql(parseEther("1.23").sub(parseEther("0.12")))

    await xdaoPeg.connect(signers[1]).burn(parseEther("0.16"))

    expect(await xdaoPeg.balanceOf(friend))
      .to.eql(
        (await xdaoPeg.totalSupply())
          .sub(parseEther("1.23"))
          .add(parseEther("0.12"))
      )
      .to.eql(parseEther("2.34").sub(parseEther("0.16")))
  })
})
