import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { randomBytes } from "crypto";
import dayjs from "dayjs";
import { BigNumber, Wallet, constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  CrowdfundingModule,
  CrowdfundingModule__factory,
  Dao,
  DaoVestingModule,
  DaoVestingModule__factory,
  Dao__factory,
  Factory,
  Factory__factory,
  LP,
  LP__factory,
  PrivateExitModule,
  PrivateExitModule__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
  XDAO__factory
} from "../../typechain-types";
import { executeTx, executeTxRaw } from "../utils";

describe("Crowdfunding", () => {
  let shop: Shop;

  let factory: Factory;

  let firstDao: Dao;
  let secondDao: Dao;

  let signer: SignerWithAddress;

  let feeAddress: SignerWithAddress;

  let deployer: SignerWithAddress;

  let privateExitModule: PrivateExitModule;

  let crowdfunding: CrowdfundingModule;

  let vesting: DaoVestingModule;

  let usdc: Token;

  let wbtc: Token;

  let lp: LP;

  beforeEach(async () => {
    signer = (await ethers.getSigners())[0];
    feeAddress = (await ethers.getSigners())[1];
    deployer = (await ethers.getSigners())[2];

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

    privateExitModule = await new PrivateExitModule__factory(signer).deploy();

    crowdfunding = (await upgrades.deployProxy(
      await ethers.getContractFactory("CrowdfundingModule")
    )) as CrowdfundingModule;

    vesting = (await upgrades.deployProxy(
      await ethers.getContractFactory("DaoVestingModule")
    )) as DaoVestingModule;

    crowdfunding.setFee(feeAddress.address, 100, 50);

    crowdfunding.setCoreAddresses(
      factory.address,
      shop.address,
      privateExitModule.address,
      vesting.address
    );

    vesting.setCoreAddresses(
      factory.address,
      shop.address,
      crowdfunding.address
    );

    usdc = await new Token__factory(signer).deploy();
    wbtc = await new Token__factory(deployer).deploy();
  });

  it("Init Sale", async () => {
    await expect(
      crowdfunding.initSale(
        constants.AddressZero,
        constants.AddressZero,
        0,
        0,
        0,
        0,
        [],
        [false, false, false, false],
        new Array(10).fill({
          investor: new Wallet(randomBytes(32).toString("hex")).address,
          allocation: 1,
        })
      )
    ).to.be.revertedWith("CrowdfundingModule: only for DAOs");
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
          [crowdfunding.address, usdc.address, constants.Zero, parseEther("20")]
        ),
        0,
        signer
      );
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(parseEther("0"));

      await crowdfunding.fillLpBalance(firstDao.address, 0);

      expect(await lp.balanceOf(crowdfunding.address)).to.eql(parseEther("20"));
    });

    it("Base Crowdfunding", async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        [],
      ]);

      await executeTxRaw(
        secondDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("1"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      await expect(
        executeTxRaw(
          firstDao.address,
          crowdfunding.address,
          CrowdfundingModule__factory.createInterface().encodeFunctionData(
            "initSale",
            [
              usdc.address,
              lp.address,
              parseEther("2"),
              parseEther("100"),
              0,
              0,
              [],
              [false, false, false, false],
              [],
            ]
          ),
          0,
          signer
        )
      ).to.be.revertedWith("CrowdfundingModule: Crowdfunding already exists");

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await expect(
        crowdfunding.buy(secondDao.address, parseEther("4"), true)
      ).to.be.revertedWith("CrowdfundingModule: not enough balance");

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("1.98"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("96"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("18.02")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.04")
      );

      await crowdfunding.buy(firstDao.address, parseEther("4"), false);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("3.97"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("92"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("16.03")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("7.94"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.06")
      );

      await executeTxRaw(
        firstDao.address,
        privateExitModule.address,
        PrivateExitModule__factory.createInterface().encodeFunctionData(
          "createPrivateExitOffer",
          [crowdfunding.address, parseEther("12"), constants.Zero, [], []]
        ),
        0,
        signer
      );

      await crowdfunding.burnLp(firstDao.address, 0);
      
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("4.03")
      );
    });

    it("Timestamp Crowdfunding", async () => {
      const timestamp = dayjs().unix();
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            BigNumber.from(timestamp),
            0,
            [],
            [true, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        true,
        false,
        false,
        false,
        BigNumber.from(timestamp),
        constants.Zero,
        [],
        [],
      ]);

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("2"), true)
      ).to.be.revertedWith("CrowdfundingModule: sale is over");
    });

    it("Limited Maximum Amount", async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [parseEther("5")],
            [false, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("5"),
        false,
        false,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        [],
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("8"), true)
      ).to.be.revertedWith("CrowdfundingModule: amount is off the limits");

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("1.98"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("96"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("18.02")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.04")
      );

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("2"), true)
      ).to.be.revertedWith("CrowdfundingModule: amount is off the limits");
    });

    it("Limited Minimum Amount", async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [parseEther("5"), parseEther("20")],
            [false, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        parseEther("5"),
        parseEther("20"),
        false,
        false,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        [],
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("2"), true)
      ).to.be.revertedWith("CrowdfundingModule: amount is off the limits");

      await crowdfunding.buy(firstDao.address, parseEther("8"), true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("92"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("16.04")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("7.92"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.08")
      );

      await crowdfunding.buy(firstDao.address, parseEther("2"), true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("4.95"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("90"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("15.05")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("9.9"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.1")
      );
    });

    it("Whitelisted Crowdfunding: Add", async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => ({
          investor: new Wallet(randomBytes(32).toString("hex")).address,
          allocation: 0,
        }))
        .filter(({ investor }) => investor !== signer.address);

      await expect(
        executeTxRaw(
          firstDao.address,
          crowdfunding.address,
          CrowdfundingModule__factory.createInterface().encodeFunctionData(
            "editSale",
            [parseEther("20"), 0, [], [], randomAddresses]
          ),
          0,
          signer
        )
      ).to.be.revertedWith("CrowdfundingModule: Crowdfunding doesn't exists");

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, true, false],
            randomAddresses,
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses.map(({ investor }) => investor),
        randomAddresses.map(() => constants.Zero),
      ]);

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("1"), true)
      ).to.be.revertedWith("CrowdfundingModule: the buyer is not whitelisted");

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "editSale",
          [
            parseEther("20"),
            0,
            [],
            [],
            [
              {
                investor: signer.address,
                allocation: 0,
              },
            ],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses.map(({ investor }) => investor).concat(signer.address),
        randomAddresses.map(() => constants.Zero).concat(constants.Zero),
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("1.98"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("96"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("18.02")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.04")
      );
    });

    it("Whitelisted Crowdfunding: Remove", async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => ({
          investor: new Wallet(randomBytes(32).toString("hex")).address,
          allocation: 0,
        }))
        .filter(({ investor }) => investor !== signer.address)
        .concat({
          investor: signer.address,
          allocation: 0,
        });

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, true, false],
            randomAddresses,
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses.map(({ investor }) => investor),
        randomAddresses.map(() => constants.Zero),
      ]);

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "editSale",
          [parseEther("20"), 0, [], [signer.address], []]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses
          .map(({ investor }) => investor)
          .filter((invertor) => invertor !== signer.address),
        randomAddresses
          .map(() => constants.Zero)
          .slice(0, randomAddresses.length - 1),
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await expect(
        crowdfunding.buy(firstDao.address, parseEther("1"), true)
      ).to.be.revertedWith("CrowdfundingModule: the buyer is not whitelisted");
    });

    it("Whitelisted Crowdfunding with Allocations", async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => ({
          investor: new Wallet(randomBytes(32).toString("hex")).address,
          allocation: parseEther("1"),
        }))
        .filter(({ investor }) => investor !== signer.address);

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, true, true],
            randomAddresses,
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        true,
        constants.Zero,
        constants.Zero,
        randomAddresses.map(({ investor }) => investor),
        randomAddresses.map(({ allocation }) => allocation),
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await expect(
        crowdfunding.buy(firstDao.address, 0, true)
      ).to.be.revertedWith("CrowdfundingModule: the buyer is not whitelisted");

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "editSale",
          [
            parseEther("20"),
            0,
            [],
            [],
            [
              {
                investor: signer.address,
                allocation: parseEther("6"),
              },
            ],
          ]
        ),
        0,
        signer
      );
      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        true,
        true,
        constants.Zero,
        constants.Zero,
        randomAddresses.map(({ investor }) => investor).concat(signer.address),
        randomAddresses
          .map(({ allocation }) => allocation)
          .concat(parseEther("6")),
      ]);

      await crowdfunding.buy(firstDao.address, 0, true);

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("2.97"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("94"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("17.03")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("5.94"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.06")
      );

      await expect(
        crowdfunding.buy(firstDao.address, 0, true)
      ).to.be.revertedWith("CrowdfundingModule: already bought");
    });

    it("Crowdfunding with Vesting", async () => {
      const timeBase = dayjs();

      await expect(
        executeTxRaw(
          firstDao.address,
          crowdfunding.address,
          CrowdfundingModule__factory.createInterface().encodeFunctionData(
            "initSale",
            [
              usdc.address,
              lp.address,
              parseEther("2"),
              parseEther("20"),
              0,
              0,
              [],
              [false, true, false, false],
              [],
            ]
          ),
          0,
          signer
        )
      ).to.be.revertedWith("CrowdfundingModule: Invalid vesting");

      await executeTxRaw(
        firstDao.address,
        vesting.address,
        DaoVestingModule__factory.createInterface().encodeFunctionData(
          "initVesting",
          [
            lp.address,
            timeBase.add(4, "week").unix(),
            timeBase.add(12, "week").unix() - timeBase.unix(),
            [],
          ]
        ),
        0,
        signer
      );

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(timeBase.add(4, "week").unix().toString()),
        BigNumber.from(
          (timeBase.add(12, "week").unix() - timeBase.unix()).toString()
        ),
        [],
        [],
      ]);

      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            lp.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, true, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        lp.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        true,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        [],
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await vesting.getVesting(firstDao.address, 0)).to.eql([
        lp.address,
        BigNumber.from(timeBase.add(4, "week").unix().toString()),
        BigNumber.from(
          (timeBase.add(12, "week").unix() - timeBase.unix()).toString()
        ),
        [signer.address],
        [parseEther("1.98")],
      ]);

      expect(await lp.balanceOf(vesting.address)).to.eql(parseEther("1.98"));
      expect(await lp.balanceOf(signer.address)).to.eql(parseEther("0"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("96"));
      expect(await lp.balanceOf(crowdfunding.address)).to.eql(
        parseEther("18.02")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.04")
      );
    });

    afterEach(async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "closeSale"
        ),
        0,
        signer
      );
    });
  });

  describe("With Custom Token", () => {
    it("Base Crowdfunding", async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "initSale",
          [
            usdc.address,
            wbtc.address,
            parseEther("2"),
            parseEther("20"),
            0,
            0,
            [],
            [false, false, false, false],
            [],
          ]
        ),
        0,
        signer
      );

      expect(await wbtc.balanceOf(crowdfunding.address)).to.eql(
        parseEther("0")
      );
      await wbtc
        .connect(deployer)
        .approve(crowdfunding.address, parseEther("20"));
      await crowdfunding
        .connect(deployer)
        .fillTokenBalance(firstDao.address, parseEther("20"));
      expect(await wbtc.balanceOf(crowdfunding.address)).to.eql(
        parseEther("20")
      );
      expect(await crowdfunding.getSaleInfo(firstDao.address, 0)).to.eql([
        usdc.address,
        wbtc.address,
        parseEther("2"),
        parseEther("20"),
        constants.Zero,
        parseEther("20"),
        false,
        false,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        [],
      ]);

      await usdc.approve(crowdfunding.address, parseEther("10"));

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await wbtc.balanceOf(signer.address)).to.eql(parseEther("1.98"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("96"));
      expect(await wbtc.balanceOf(crowdfunding.address)).to.eql(
        parseEther("18.02")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.04")
      );

      await crowdfunding.buy(firstDao.address, parseEther("4"), true);

      expect(await wbtc.balanceOf(signer.address)).to.eql(parseEther("3.96"));
      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther("92"));
      expect(await wbtc.balanceOf(crowdfunding.address)).to.eql(
        parseEther("16.04")
      );

      expect(await usdc.balanceOf(firstDao.address)).to.eql(parseEther("7.92"));
      expect(await usdc.balanceOf(feeAddress.address)).to.eql(
        parseEther("0.08")
      );
    });

    afterEach(async () => {
      await executeTxRaw(
        firstDao.address,
        crowdfunding.address,
        CrowdfundingModule__factory.createInterface().encodeFunctionData(
          "closeSale"
        ),
        0,
        signer
      );

      expect(await wbtc.balanceOf(crowdfunding.address)).to.eql(
        parseEther("0")
      );
      expect(await wbtc.balanceOf(firstDao.address)).to.eql(
        parseEther("16.04")
      );
    });
  });
});
