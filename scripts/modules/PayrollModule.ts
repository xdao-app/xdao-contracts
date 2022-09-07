import { ethers, run, upgrades } from 'hardhat'

import { PayrollModule } from '../../typechain-types'

async function main() {
  const Payroll = await ethers.getContractFactory('PayrollModule')

  const payroll = (await upgrades.deployProxy(Payroll, [
    '0x72cc6E4DE47f673062c41C67505188144a0a3D84'
  ])) as PayrollModule

  await payroll.deployed()

  console.log('PayrollModule:', payroll.address)

  await new Promise((r) => setTimeout(r, 10000))

  try {
    await run('verify:verify', {
      address: await upgrades.erc1967.getImplementationAddress(payroll.address),
      contract: 'contracts/modules/PayrollModule.sol:PayrollModule'
    })
  } catch {
    console.log('Verification problem (PayrollModule)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
