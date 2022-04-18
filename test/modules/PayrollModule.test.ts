import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import dayjs from 'dayjs'
import { BigNumber, constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  PayrollModule,
  PayrollModule__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
  XDAO__factory
} from '../../typechain-types'
import { executeTx, executeTxRaw } from '../utils'

describe('PayrollModule', () => {
  let shop: Shop

  let factory: Factory

  let dao: Dao

  let signer: SignerWithAddress

  let employee: SignerWithAddress

  let payrollModule: PayrollModule

  let usdc: Token

  let timestampBase: dayjs.Dayjs

  const payrollEncoder = PayrollModule__factory.createInterface()

  after(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })

  beforeEach(async () => {
    timestampBase = dayjs()

    const signers = await ethers.getSigners()

    signer = signers[0]

    employee = signers[1]

    shop = await new Shop__factory(signer).deploy()

    const xdao = await new XDAO__factory(signer).deploy()

    factory = await new Factory__factory(signer).deploy(
      shop.address,
      xdao.address
    )

    await shop.setFactory(factory.address)

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    dao = Dao__factory.connect(await factory.daoAt(0), signer)

    payrollModule = (await upgrades.deployProxy(
      await ethers.getContractFactory('PayrollModule'),
      [factory.address]
    )) as PayrollModule

    usdc = await new Token__factory(signer).deploy()
    await usdc.transfer(dao.address, parseEther('100'))
  })

  it('Not Inited Payroll', async () => {
    expect(
      await Promise.all([
        usdc.balanceOf(dao.address),
        usdc.balanceOf(employee.address)
      ])
    ).to.eql([parseEther('100'), constants.Zero])

    expect(await payrollModule.numberOfPayrolls(dao.address)).to.eql(
      constants.Zero
    )

    await expect(payrollModule.claimPayroll(dao.address, 0)).to.be.revertedWith(
      'PayrollModule: Unknown recipient'
    )

    await expect(
      payrollModule.initPayroll(
        employee.address,
        timestampBase.unix(),
        timestampBase.add(3, 'day').unix(),
        usdc.address,
        parseEther('0.0001')
      )
    ).to.be.revertedWith('PayrollModule: only for DAOs')
  })

  it('Init Payroll and not Approve', async () => {
    await executeTxRaw(
      dao.address,
      payrollModule.address,
      payrollEncoder.encodeFunctionData('initPayroll', [
        employee.address,
        timestampBase.unix(),
        timestampBase.add(3, 'day').unix(),
        usdc.address,
        parseEther('0.0001')
      ]),
      0,
      signer
    )

    await expect(payrollModule.claimPayroll(dao.address, 0)).to.be.reverted
  })

  it('Claim Payroll before Start', async () => {
    await executeTxRaw(
      dao.address,
      payrollModule.address,
      payrollEncoder.encodeFunctionData('initPayroll', [
        employee.address,
        timestampBase.add(1, 'day').unix(),
        timestampBase.add(3, 'day').unix(),
        usdc.address,
        parseEther('0.0001')
      ]),
      0,
      signer
    )

    await executeTx(
      dao.address,
      usdc.address,
      'approve',
      ['address', 'uint256'],
      [payrollModule.address, constants.MaxUint256],
      0,
      signer
    )

    await expect(payrollModule.claimPayroll(dao.address, 0)).to.be.reverted
  })

  describe('Init Payroll and Approve', () => {
    beforeEach(async () => {
      await executeTxRaw(
        dao.address,
        payrollModule.address,
        payrollEncoder.encodeFunctionData('initPayroll', [
          employee.address,
          timestampBase.unix(),
          timestampBase.add(2, 'day').unix(),
          usdc.address,
          parseEther('0.0001')
        ]),
        0,
        signer
      )

      await executeTx(
        dao.address,
        usdc.address,
        'approve',
        ['address', 'uint256'],
        [payrollModule.address, constants.MaxUint256],
        0,
        signer
      )
    })

    it('Claim Payroll', async () => {
      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          true,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(2, 'day').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.unix())
        ]
      ])

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(6, 'hour').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 0)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('97.84'), parseEther('2.16')])

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          true,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(2, 'day').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.add(6, 'hour').unix())
        ]
      ])
    })

    it('Disable Payroll', async () => {
      await expect(payrollModule.disablePayroll(0)).to.be.revertedWith(
        'PayrollModule: only for DAOs'
      )

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(12, 'hour').unix()
      ])

      await executeTxRaw(
        dao.address,
        payrollModule.address,
        payrollEncoder.encodeFunctionData('disablePayroll', [0]),
        0,
        signer
      )

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          false,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(12, 'hour').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.unix())
        ]
      ])

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(13, 'hour').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 0)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('95.68'), parseEther('4.32')])

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          false,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(12, 'hour').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.add(12, 'hour').unix())
        ]
      ])

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(14, 'hour').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 0)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('95.68'), parseEther('4.32')])
    })

    it('Change Payroll Amount Per Second', async () => {
      await expect(
        payrollModule.changePayrollAmountPerSecond(0, parseEther('0.0003'))
      ).to.be.revertedWith('PayrollModule: only for DAOs')

      await executeTxRaw(
        dao.address,
        payrollModule.address,
        payrollEncoder.encodeFunctionData('changePayrollAmountPerSecond', [
          0,
          parseEther('0.0003')
        ]),
        0,
        signer
      )

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          true,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(2, 'day').unix()),
          usdc.address,
          parseEther('0.0003'),
          BigNumber.from(timestampBase.unix())
        ]
      ])

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(1, 'day').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 0)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('74.08'), parseEther('25.92')])
    })

    it('Second Payroll', async () => {
      await expect(
        payrollModule.claimPayroll(dao.address, 1)
      ).to.be.revertedWith('PayrollModule: Unknown recipient')

      await executeTxRaw(
        dao.address,
        payrollModule.address,
        payrollEncoder.encodeFunctionData('initPayroll', [
          signer.address,
          timestampBase.unix(),
          timestampBase.add(3, 'day').unix(),
          usdc.address,
          parseEther('0.0007')
        ]),
        0,
        signer
      )

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          true,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(2, 'day').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.unix())
        ],
        [
          true,
          signer.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(3, 'day').unix()),
          usdc.address,
          parseEther('0.0007'),
          BigNumber.from(timestampBase.unix())
        ]
      ])

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(32, 'hour').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 1)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(signer.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('19.36'), parseEther('80.64'), parseEther('0')])
    })

    it('Claim Payroll after Payroll Ends', async () => {
      await expect(
        payrollModule.claimPayroll(dao.address, 1)
      ).to.be.revertedWith('PayrollModule: Unknown recipient')

      await network.provider.send('evm_setNextBlockTimestamp', [
        timestampBase.add(65, 'hour').unix()
      ])

      await payrollModule.claimPayroll(dao.address, 0)

      expect(
        await Promise.all([
          usdc.balanceOf(dao.address),
          usdc.balanceOf(employee.address)
        ])
      ).to.eql([parseEther('82.72'), parseEther('17.28')])

      expect(await payrollModule.getDaoPayrolls(dao.address)).to.eql([
        [
          true,
          employee.address,
          BigNumber.from(timestampBase.unix()),
          BigNumber.from(timestampBase.add(2, 'day').unix()),
          usdc.address,
          parseEther('0.0001'),
          BigNumber.from(timestampBase.add(2, 'day').unix())
        ]
      ])
    })
  })
})
