import { expect } from 'chai'
import { randomBytes } from 'crypto'
import dayjs from 'dayjs'
import { BigNumber, constants, Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  Dao__factory,
  Factory__factory,
  PayrollModule,
  Token__factory,
  XDAO__factory
} from '../../typechain-types'
import { executeTx } from '../utils'

describe('PayrollModule', () => {
  it('Init payroll', async () => {
    const [signer] = await ethers.getSigners()
    const timestampBase = dayjs()
    const timestampLimit = timestampBase.add(100, 'year').unix()
    const timestampInitialClaim = timestampBase.unix()
    const timestampOneDayLater = timestampBase.add(1, 'day').unix()
    const timestampTwoDaysLater = timestampBase.add(2, 'day').unix()
    const timestampThreeDaysLater = timestampBase.add(3, 'day').unix()
    const timestampFourDaysLater = timestampBase.add(4, 'day').unix()

    const amountPerSecondCurrent = parseEther('0.0001')
    const amountPerSecondNew = parseEther('0.00011')

    const employee = new Wallet(randomBytes(32).toString('hex')).address

    const xdao = await new XDAO__factory(signer).deploy()

    const factory = await new Factory__factory(signer).deploy(
      constants.AddressZero,
      xdao.address
    )

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    const dao = Dao__factory.connect(await factory.daoAt(0), signer)

    await signer.sendTransaction({
      to: dao.address,
      value: parseEther('12')
    })

    const usdc = await new Token__factory(signer).deploy()

    await usdc.transfer(dao.address, parseEther('100'))

    const payrollModule = (await upgrades.deployProxy(
      await ethers.getContractFactory('PayrollModule'),
      [factory.address]
    )) as PayrollModule

    await executeTx(
      dao.address,
      usdc.address,
      'approve',
      ['address', 'uint256'],
      [payrollModule.address, constants.MaxUint256],
      0,
      signer
    )

    expect(
      await Promise.all([usdc.balanceOf(dao.address), usdc.balanceOf(employee)])
    ).to.eql([parseEther('100'), constants.Zero])

    expect(await payrollModule.numberOfPayrolls(dao.address)).to.eql(
      BigNumber.from('0')
    )

    expect(payrollModule.claimPayroll(dao.address, 0)).to.be.revertedWith(
      'PayrollModule: Unknown recipient'
    )

    expect(
      payrollModule.initPayroll(
        employee,
        timestampLimit,
        usdc.address,
        amountPerSecondCurrent,
        timestampInitialClaim
      )
    ).to.be.revertedWith('PayrollModule: only for DAOs')

    await executeTx(
      dao.address,
      payrollModule.address,
      'initPayroll',
      ['address', 'uint256', 'address', 'uint256', 'uint256'],
      [
        employee,
        timestampLimit,
        usdc.address,
        amountPerSecondCurrent,
        timestampInitialClaim
      ],
      0,
      signer
    )

    expect(await payrollModule.numberOfPayrolls(dao.address)).to.eql(
      BigNumber.from('1')
    )

    const amountPerSecondBlockchainBeforeChange = (
      await payrollModule.payrolls(dao.address, 0)
    ).amountPerSecond

    describe('Actions', async () => {
      const daoBalanceAfterFirstPay = parseEther('100').sub(parseEther('8.64'))
      const daoBalanceAfterSecondPay = daoBalanceAfterFirstPay.sub(
        parseEther('8.64')
      )

      it('First Paying', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampOneDayLater
        ])

        await payrollModule.claimPayroll(dao.address, 0)

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterFirstPay,
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond.mul(
            timestampOneDayLater - timestampInitialClaim
          )
        ])
      })

      it('Second Paying before Change payroll amount', async () => {
        expect(
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond
        ).to.eq(amountPerSecondCurrent)

        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampTwoDaysLater
        ])

        await executeTx(
          dao.address,
          payrollModule.address,
          'changePayrollAmount',
          ['uint256', 'uint256'],
          [0, amountPerSecondNew],
          0,
          signer
        )

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterSecondPay,
          amountPerSecondBlockchainBeforeChange.mul(
            timestampTwoDaysLater - timestampInitialClaim
          )
        ])

        expect(
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond
        ).to.eq(amountPerSecondNew)
      })

      it('Third Paying after Change payroll amount', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampThreeDaysLater
        ])

        await executeTx(
          dao.address,
          payrollModule.address,
          'dismiss',
          ['uint256'],
          [0],
          0,
          signer
        )

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterSecondPay.sub(parseEther('9.504')),
          amountPerSecondBlockchainBeforeChange
            .mul(timestampTwoDaysLater - timestampInitialClaim)
            .add(
              (
                await payrollModule.payrolls(dao.address, 0)
              ).amountPerSecond.mul(
                timestampThreeDaysLater - timestampTwoDaysLater
              )
            )
        ])
      })

      it('Attempt to Pay after Dismissal', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampFourDaysLater
        ])

        expect(payrollModule.claimPayroll(dao.address, 0)).to.be.revertedWith(
          'PayrollModule: Payroll already claimed'
        )
      })

      it('Change payroll amount by not DAO', async () => {
        expect(
          payrollModule.changePayrollAmount(0, amountPerSecondNew)
        ).to.be.revertedWith('PayrollModule: only for DAOs')
      })

      it('Dismiss by not DAO', async () => {
        expect(payrollModule.dismiss(0)).to.be.revertedWith(
          'PayrollModule: only for DAOs'
        )
      })
    })
  })
})
