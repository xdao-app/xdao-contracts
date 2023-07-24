import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { randomBytes } from "crypto";
import dayjs from "dayjs";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";

import { createData, createTxHash, executeTxRaw } from "../../test/utils";
import {
	Dao,
	Dao__factory,
	DaoManager,
	Factory,
	Factory__factory,
	Shop,
	Shop__factory,
	Token__factory,
} from "../../typechain-types";

describe("DaoManager", () => {
	let signers: SignerWithAddress[];

	let shop: Shop;

	let factory: Factory;

	let dao: Dao;

	let daoManager: DaoManager;

	after(async () => {
		await network.provider.request({ method: "hardhat_reset", params: [] });
	});

	beforeEach(async () => {
		await network.provider.request({ method: "hardhat_reset", params: [] });

		signers = await ethers.getSigners();

		const xdao = await new Token__factory(signers[0]).deploy();

		shop = await new Shop__factory(signers[0]).deploy();

		factory = await new Factory__factory(signers[0]).deploy(
			shop.address,
			xdao.address,
		);

		await shop.setFactory(factory.address);

		await factory.create(
			"",
			"",
			51,
			[signers[0].address, signers[1].address],
			[parseEther("100"), parseEther("50")],
		);

		dao = Dao__factory.connect(await factory.daoAt(0), signers[0]);

		daoManager = (await upgrades.deployProxy(
			await ethers.getContractFactory("DaoManager"),
			[factory.address],
		)) as DaoManager;
	});

	it("Only for permitted", async () => {
		const timestamp = dayjs().unix();
		const targetList = [dao.address, dao.address, dao.address, dao.address];
		const dataList = [
			createData(
				"burn",
				["address", "uint256"],
				[signers[1].address, parseEther("50")],
			),
			createData(
				"mint",
				["address", "uint256"],
				[signers[2].address, parseEther("100")],
			),
			createData(
				"mint",
				["address", "uint256"],
				[signers[3].address, parseEther("50")],
			),
			createData(
				"mint",
				["address", "uint256"],
				[signers[4].address, parseEther("50")],
			),
		];
		const valueList = [0, 0, 0, 0];

		const data = createData(
			"addArgsHash",
			["bytes32"],
			[
				await daoManager.calculateArgsHash(
					dao.address,
					targetList,
					dataList,
					valueList,
				),
			],
		);

		const signature = await signers[0].signMessage(
			createTxHash(
				dao.address,
				daoManager.address,
				data,
				0,
				0,
				timestamp,
				1337,
			),
		);
		await expect(
			daoManager.activate(
				dao.address,
				targetList,
				dataList,
				valueList,
				0,
				timestamp,
				[signature],
			),
		).to.be.revertedWith("DAO: only for permitted");
	});

	describe("Dao Manager", () => {
		beforeEach(async () => {
			await executeTxRaw(
				dao.address,
				dao.address,
				Dao__factory.createInterface().encodeFunctionData("addPermitted", [
					daoManager.address,
				]),
				0,
				signers[0],
			);
		});

		it("Multi mint/burn", async () => {
			const timestamp = dayjs().unix();
			const targetList = [dao.address, dao.address, dao.address, dao.address];
			const dataList = [
				createData(
					"burn",
					["address", "uint256"],
					[signers[1].address, parseEther("50")],
				),
				createData(
					"mint",
					["address", "uint256"],
					[signers[2].address, parseEther("100")],
				),
				createData(
					"mint",
					["address", "uint256"],
					[signers[3].address, parseEther("50")],
				),
				createData(
					"mint",
					["address", "uint256"],
					[signers[4].address, parseEther("50")],
				),
			];
			const valueList = [0, 0, 0, 0];

			const data = createData(
				"addArgsHash",
				["bytes32"],
				[
					await daoManager.calculateArgsHash(
						dao.address,
						targetList,
						dataList,
						valueList,
					),
				],
			);

			const signature = await signers[0].signMessage(
				createTxHash(
					dao.address,
					daoManager.address,
					data,
					0,
					0,
					timestamp,
					1337,
				),
			);

			await expect(
				daoManager.activate(
					dao.address,
					targetList.slice(2),
					dataList,
					[],
					0,
					timestamp,
					[signature],
				),
			).to.be.revertedWith("DaoManager: Invalid Tx parameters");

			await expect(
				daoManager
					.connect(signers[2])
					.activate(
						dao.address,
						targetList,
						dataList,
						valueList,
						0,
						timestamp,
						[signature],
					),
			).to.be.revertedWith("DaoManager: only for members");

			await daoManager.activate(
				dao.address,
				targetList,
				dataList,
				valueList,
				0,
				timestamp,
				[signature],
			);

			expect(await dao.balanceOf(signers[1].address)).to.eql(parseEther("0"));
			expect(await dao.balanceOf(signers[2].address)).to.eql(parseEther("100"));
			expect(await dao.balanceOf(signers[3].address)).to.eql(parseEther("50"));
			expect(await dao.balanceOf(signers[4].address)).to.eql(parseEther("50"));
		});
		it("Send ETH", async () => {
			await signers[0].sendTransaction({
				to: dao.address,
				value: parseEther("16"),
			});

			expect(await ethers.provider.getBalance(dao.address)).to.eql(
				parseEther("16"),
			);

			const address1 = new Wallet(randomBytes(32).toString("hex")).address;
			const address2 = new Wallet(randomBytes(32).toString("hex")).address;
			const address3 = new Wallet(randomBytes(32).toString("hex")).address;

			const timestamp = dayjs().unix();
			const targetList = [address1, address2, address3];
			const dataList = ["0x", "0x", "0x"];
			const valueList = [parseEther("5"), parseEther("5"), parseEther("5")];

			const data = createData(
				"addArgsHash",
				["bytes32"],
				[
					await daoManager.calculateArgsHash(
						dao.address,
						targetList,
						dataList,
						valueList,
					),
				],
			);

			const signature = await signers[0].signMessage(
				createTxHash(
					dao.address,
					daoManager.address,
					data,
					0,
					0,
					timestamp,
					1337,
				),
			);

			await daoManager.activate(
				dao.address,
				targetList,
				dataList,
				valueList,
				0,
				timestamp,
				[signature],
			);

			expect(
				await Promise.all([
					ethers.provider.getBalance(dao.address),
					ethers.provider.getBalance(address1),
					ethers.provider.getBalance(address2),
					ethers.provider.getBalance(address3),
				]),
			).to.eql([
				parseEther("1"),
				parseEther("5"),
				parseEther("5"),
				parseEther("5"),
			]);
		});
	});
});
