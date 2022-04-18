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
  it('Full cycle', async () => {
    const [signer] = await ethers.getSigners()
    const timestampBase = dayjs()
    const timestampLimit = timestampBase.add(100, 'year').unix()
    const timestampInitialClaim = timestampBase.unix()
    const timestampTwelveHoursLater = timestampBase.add(12, 'hour').unix()
    const timestampOneDayLater = timestampBase.add(1, 'day').unix()
    const timestampOneDayTwelveHoursLater = timestampBase
      .add(1, 'day')
      .add(12, 'hour')
      .unix()

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
        timestampInitialClaim,
        timestampLimit,
        usdc.address,
        amountPerSecondCurrent
      )
    ).to.be.revertedWith('PayrollModule: only for DAOs')

    await executeTx(
      dao.address,
      payrollModule.address,
      'initPayroll',
      ['address', 'uint256', 'uint256', 'address', 'uint256'],
      [
        employee,
        timestampInitialClaim,
        timestampLimit,
        usdc.address,
        amountPerSecondCurrent
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
      const daoBalanceAfterFirstPay = parseEther('100').sub(parseEther('4.32'))
      const daoBalanceAfterSecondPay = daoBalanceAfterFirstPay.sub(
        parseEther('4.32')
      )

      it('First Paying', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampTwelveHoursLater
        ])

        await expect(payrollModule.claimPayroll(dao.address, 0)).not.to.be
          .reverted

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterFirstPay,
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond.mul(
            timestampTwelveHoursLater - timestampInitialClaim
          )
        ])
      })

      it('Second Paying before Change payroll amount', async () => {
        expect(
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond
        ).to.eq(amountPerSecondCurrent)

        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampOneDayLater
        ])

        await expect(payrollModule.claimPayroll(dao.address, 0)).not.to.be
          .reverted

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterSecondPay,
          amountPerSecondBlockchainBeforeChange.mul(
            timestampOneDayLater - timestampInitialClaim
          )
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
          (await payrollModule.payrolls(dao.address, 0)).amountPerSecond
        ).to.eq(amountPerSecondNew)
      })

      it('Third Paying after Change payroll amount', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampOneDayTwelveHoursLater
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
          daoBalanceAfterSecondPay,
          amountPerSecondBlockchainBeforeChange.mul(
            timestampOneDayLater - timestampInitialClaim
          )
        ])
      })

      it('First Attempt to Pay after Dismissal', async () => {
        await expect(payrollModule.claimPayroll(dao.address, 0)).not.to.be
          .reverted

        expect(
          await Promise.all([
            usdc.balanceOf(dao.address),
            usdc.balanceOf(employee)
          ])
        ).to.eql([
          daoBalanceAfterSecondPay.sub(parseEther('4.752')),
          amountPerSecondBlockchainBeforeChange
            .mul(timestampOneDayLater - timestampInitialClaim)
            .add(
              (
                await payrollModule.payrolls(dao.address, 0)
              ).amountPerSecond.mul(
                timestampOneDayTwelveHoursLater - timestampOneDayLater
              )
            )
        ])
      })

      it('Second Attempt to Pay after Dismissal', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampBase.add(2, 'day').unix()
        ])

        await expect(
          payrollModule.claimPayroll(dao.address, 0)
        ).to.be.revertedWith('PayrollModule: Payroll already claimed')
      })

      it('Get Payrolls info', async () => {
        const daoPayrolls = (
          await payrollModule.getDaoPayrolls(dao.address)
        ).map(
          ({
            recipient,
            payrollStartTimestamp,
            activeUntilTimestamp,
            currency,
            amountPerSecond,
            lastClaimTimestamp
          }) => ({
            recipient,
            payrollStartTimestamp,
            activeUntilTimestamp,
            currency,
            amountPerSecond,
            lastClaimTimestamp
          })
        )

        expect(daoPayrolls.length).to.eq(1)
        expect(daoPayrolls[0]).to.eql({
          recipient: employee,
          payrollStartTimestamp: BigNumber.from(timestampInitialClaim),
          activeUntilTimestamp: BigNumber.from(timestampOneDayTwelveHoursLater),
          currency: usdc.address,
          amountPerSecond: amountPerSecondNew,
          lastClaimTimestamp: BigNumber.from(timestampOneDayTwelveHoursLater)
        })

        expect(payrollModule.claimPayroll(dao.address, 0)).to.be.revertedWith(
          'PayrollModule: Payroll already claimed'
        )
      })

      it('Change payroll amount by not DAO', async () => {
        await expect(
          payrollModule.changePayrollAmount(0, amountPerSecondNew)
        ).to.be.revertedWith('PayrollModule: only for DAOs')
      })

      it('Dismiss by not DAO', async () => {
        await expect(payrollModule.dismiss(0)).to.be.revertedWith(
          'PayrollModule: only for DAOs'
        )
      })

      it('Attempt to Dismiss again after Dismissal', async () => {
        await network.provider.send('evm_setNextBlockTimestamp', [
          timestampBase.add(2, 'day').add(12, 'hour').unix()
        ])

        setTimeout(async () => {
          return await expect(
            executeTx(
              dao.address,
              payrollModule.address,
              'dismiss',
              ['uint256'],
              [0],
              0,
              signer
            )
          ).to.be.revertedWith('PayrollModule: Payroll is not active')
        }, 2000)
      })
    })
  })
})
