import { ethers, network, run, upgrades } from "hardhat";

import {
  CrowdfundingModule,
  DaoManager,
  DaoVestingModule,
} from "../../typechain-types";

async function main() {
  console.log(`Deploy Started with chain ID: ${network.config.chainId}`);

  const [signer] = await ethers.getSigners();

  console.log(`Account: ${signer.address}`);

  const DaoManager = (await upgrades.deployProxy(
    await ethers.getContractFactory("DaoManager"),
    ["0x72cc6E4DE47f673062c41C67505188144a0a3D84"],
    { kind: "uups" }
  )) as DaoManager;

  await DaoManager.deployed();

  console.log("DaoManager:", DaoManager.address);

  const CrowdfundingModule = (await upgrades.deployProxy(
    await ethers.getContractFactory("CrowdfundingModule"),
    { kind: "uups" }
  )) as CrowdfundingModule;

  await CrowdfundingModule.deployed();

  console.log("CrowdfundingModule:", CrowdfundingModule.address);

  const VestingModule = (await upgrades.deployProxy(
    await ethers.getContractFactory("DaoVestingModule"),
    { kind: "uups" }
  )) as DaoVestingModule;

  await VestingModule.deployed();

  console.log("DaoVestingModule:", VestingModule.address);

  await (
    await CrowdfundingModule.setFee(
      "0x333330cd9c430fae7536ed9684f511f229527e09",
      500, // 5%
      0 // 0%
    )
  ).wait();

  await (
    await VestingModule.setCoreAddresses(
      "0x72cc6E4DE47f673062c41C67505188144a0a3D84",
      "0xCA49EcF7e7bb9bBc9D1d295384663F6BA5c0e366",
      CrowdfundingModule.address
    )
  ).wait();

  await (
    await CrowdfundingModule.setCoreAddresses(
      "0x72cc6E4DE47f673062c41C67505188144a0a3D84",
      "0xCA49EcF7e7bb9bBc9D1d295384663F6BA5c0e366",
      "0xc20146148cCFFCC035cEA2Fb8b17D74Fbc7DB38C", // Private Exit module Address
      VestingModule.address
    )
  ).wait();


  const implementationAddressList = await Promise.all([
    upgrades.erc1967.getImplementationAddress(DaoManager.address),
    upgrades.erc1967.getImplementationAddress(CrowdfundingModule.address),
    upgrades.erc1967.getImplementationAddress(VestingModule.address),
  ]);

  console.log("DaoManager Implementation:", implementationAddressList[0]);
  console.log(
    "CrowdfundingModule Implementation:",
    implementationAddressList[1]
  );
  console.log("DaoVestingModule Implementation:", implementationAddressList[2]);

  await new Promise((r) => setTimeout(r, 10000));

  try {
    await run("verify:verify", {
      address: implementationAddressList[0],
      contract: "contracts/modules/DaoManager.sol:DaoManager",
    });
  } catch {
    console.log("Verification problem (DaoManager)");
  }

  try {
    await run("verify:verify", {
      address: implementationAddressList[1],
      contract: "contracts/modules/CrowdfundingModule.sol:CrowdfundingModule",
    });
  } catch {
    console.log("Verification problem (CrowdfundingModule)");
  }

  try {
    await run("verify:verify", {
      address: implementationAddressList[2],
      contract: "contracts/modules/DaoVestingModule.sol:DaoVestingModule",
    });
  } catch {
    console.log("Verification problem (DaoVestingModule)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
