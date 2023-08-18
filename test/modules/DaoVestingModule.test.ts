import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import dayjs from "dayjs";
import { BigNumber, constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";

import {
  CrowdfundingModule,
  Dao,
  DaoVestingModule,
  DaoVestingModule__factory,
  Dao__factory,
  Factory,
  Factory__factory,
  LP,
  LP__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
  XDAO__factory,
} from "../../typechain-types";
import { executeTx, executeTxRaw } from "../utils";

describe("DaoVestingModule", () => {
  let signer: SignerWithAddress;
  let claimers: SignerWithAddress[];

  let shop: Shop;

  let factory: Factory;

  let firstDao: Dao;
  let secondDao: Dao;

  let crowdfunding: CrowdfundingModule;

  let vesting: DaoVestingModule;

  let usdc: Token;

  let lp: LP;

  after(async () => {
    await network.provider.request({ method: "hardhat_reset", params: [] });
  });

  beforeEach(async () => {
    await network.provider.request({ method: "hardhat_reset", params: [] });

    const signers = await ethers.getSigners();

    signer = signers[0];
    claimers = signers.slice(1, 6);

    shop = await new Shop__factory(signer).deploy();

    const xdao = await new XDAO__factory(signer).deploy();

    factory = await new Factory__factory(signer).deploy(
      shop.address,
      xdao.address
    );

    await shop.setFactory(factory.address);

    await factory.create("", "", 51, [signer.address], [parseEther("1")]);
    await factory.create("", "", 51, [signer.address], [parseEther("10")]);

    firstDao = Dao__factory.connect(await factory.daoAt(0), signer);
    secondDao = Dao__factory.connect(await factory.daoAt(1), signer);

    crowdfunding = (await upgrades.deployProxy(
      await ethers.getContractFactory("CrowdfundingModule")
    )) as CrowdfundingModule;

    vesting = (await upgrades.deployProxy(
      await ethers.getContractFactory("DaoVestingModule")
    )) as DaoVestingModule;

    vesting.setCoreAddresses(
      factory.address,
      shop.address,
      crowdfunding.address
    );

    usdc = await new Token__factory(signer).deploy();
  });

  it("Init Vesting", async () => {
    await expect(
      vesting.initVesting(constants.AddressZero, 0, 0, [])
    ).to.be.revertedWith("VestingModule: only for DAOs");
  });

  describe("With LP", () => {
    beforeEach(async () => {
      await executeTx(
        firstDao.address,
        shop.address,
        "createLp",
        ["string", "string"],
        ["MyLP", "MLP"],
        0,
        signer
      );

      lp = LP__factory.connect(await firstDao.lp(), signer);

      await executeTxRaw(
        firstDao.address,
        shop.address,
        Shop__factory.createInterface().encodeFunctionData(
          "createPrivateOffer",
          [vesting.address, usdc.address, constants.Zero, parseEther("20")]
        ),
        0,
        signer
      );

      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("0"));

      await vesting.fillLpBalance(firstDao.address, 0);
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("20"));
    });

    it("Base Vesting", async () => {
      const timeBase = dayjs();

      const start = timeBase.add(1, "day").unix();
      const duration = timeBase.add(4, "day").unix() - start;

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "initVesting",
          [
            lp.address,
            start,
            duration,
            claimers.map((claimer) => ({
              claimer: claimer.address,
              allocation: parseEther("3"),
            })),
          ]
        ),
        0,
        signer
      );

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(start.toString()),
        BigNumber.from(duration.toString()),
        claimers.map((claimer) => claimer.address),
        claimers.map(() => parseEther("3")),
      ]);

      await expect(vesting.release(firstDao.address, 0)).to.be.revertedWith(
        "VestingModule: Not eligible for release"
      );

      await expect(
        executeTxRaw(
          secondDao.address,
          vesting.address,
          DaoVestingModule__factory.createInterface().encodeFunctionData(
            "addAllocation",
            [firstDao.address, 0, signer.address, parseEther("3")]
          ),
          0,
          signer
        )
      ).to.be.revertedWith("VestingModule: only for Crowdfunding Module");

      await network.provider.send("evm_setNextBlockTimestamp", [
        start + duration / 3,
      ]);
      await network.provider.send("evm_mine");

      expect(
        await vesting.releasable(claimers[0].address, firstDao.address, 0)
      ).to.eql(parseEther("1"));

      expect(
        await vesting.releasable(signer.address, firstDao.address, 0)
      ).to.eql(parseEther("0"));

      await expect(vesting.release(firstDao.address, 0)).to.be.revertedWith(
        "VestingModule: Not eligible for release"
      );

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "addAllocations",
          [
            0,
            [
              {
                claimer: signer.address,
                allocation: parseEther("5"),
              },
            ],
          ]
        ),
        0,
        signer
      );

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(start.toString()),
        BigNumber.from(duration.toString()),
        claimers.map((claimer) => claimer.address).concat(signer.address),
        claimers.map(() => parseEther("3")).concat(parseEther("5")),
      ]);

      await network.provider.send("evm_setNextBlockTimestamp", [
        start + duration / 2,
      ]);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("0"));
      await vesting.release(firstDao.address, 0);
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("2.5"));
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("17.5"));
      expect(
        await vesting.remainingTokenAmount(firstDao.address, lp.address)
      ).to.eql(parseEther("17.5"));
      expect(
        await vesting.alreadyClaimedAmount(signer.address, firstDao.address, 0)
      ).to.eql(parseEther("2.5"));

      await network.provider.send("evm_setNextBlockTimestamp", [
        start + 2 * duration,
      ]);
      await network.provider.send("evm_mine");

      await expect(vesting.release(firstDao.address, 1)).to.be.revertedWith(
        "VestingModule: Not eligible for release"
      );

      await vesting.release(firstDao.address, 0);
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("5"));
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("15"));
      expect(
        await vesting.remainingTokenAmount(firstDao.address, lp.address)
      ).to.eql(parseEther("15"));
      expect(
        await vesting.remainingTokenAmount(secondDao.address, lp.address)
      ).to.eql(parseEther("0"));
    });

    it("Few Vestings", async () => {
      const timeBase = dayjs();

      const start = timeBase.add(1, "day").unix();
      const duration = timeBase.add(4, "day").unix() - start;

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "initVesting",
          [
            lp.address,
            start,
            duration,
            [
              {
                claimer: signer.address,
                allocation: parseEther("10"),
              },
            ],
          ]
        ),
        0,
        signer
      );

      await executeTxRaw(
        secondDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "initVesting",
          [
            lp.address,
            start,
            duration,
            [
              {
                claimer: signer.address,
                allocation: parseEther("5"),
              },
            ],
          ]
        ),
        0,
        signer
      );

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "initVesting",
          [
            lp.address,
            start + duration / 2,
            2 * duration,
            [
              {
                claimer: signer.address,
                allocation: parseEther("5"),
              },
            ],
          ]
        ),
        0,
        signer
      );

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(start.toString()),
        BigNumber.from(duration.toString()),
        [signer.address],
        [parseEther("10")],
      ]);

      expect(await vesting.getVesting(firstDao.address, 1)).to.eql([
        lp.address,
        BigNumber.from((start + duration / 2).toString()),
        BigNumber.from((2 * duration).toString()),
        [signer.address],
        [parseEther("5")],
      ]);

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "addAllocations",
          [
            0,
            [
              {
                claimer: signer.address,
                allocation: parseEther("5"),
              },
            ],
          ]
        ),
        0,
        signer
      );

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(start.toString()),
        BigNumber.from(duration.toString()),
        [signer.address],
        [parseEther("15")],
      ]);

      await network.provider.send("evm_setNextBlockTimestamp", [
        start + duration,
      ]);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("0"));
      await vesting.release(firstDao.address, 1);
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("1.25"));
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("18.75"));

      await expect(vesting.release(secondDao.address, 0)).to.be.revertedWith(
        "VestingModule: Not enough balance"
      );

      await vesting.release(firstDao.address, 0);
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("16.25"));
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("3.75"));

      await lp.approve(vesting.address, parseEther("100"));

      await vesting.fillTokenBalance(
        secondDao.address,
        lp.address,
        parseEther("3")
      );
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("6.75"));
      await expect(vesting.release(secondDao.address, 0)).to.be.revertedWith(
        "VestingModule: Not enough balance"
      );

      await vesting.fillTokenBalance(
        secondDao.address,
        lp.address,
        parseEther("2")
      );
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("8.75"));
      await vesting.release(secondDao.address, 0);
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("16.25"));
      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("3.75"));
    });
  });
});
