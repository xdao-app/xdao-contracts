import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { randomBytes } from 'crypto'
import dayjs from 'dayjs'
import { BigNumber, constants, Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, upgrades } from 'hardhat'

import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  LaunchpadModule,
  LaunchpadModule__factory,
  LP,
  LP__factory,
  PrivateExitModule,
  PrivateExitModule__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory,
  XDAO__factory
} from '../../typechain-types'
import { createData, executeTx, executeTxRaw } from '../utils'

describe('Launchpad', () => {
  let shop: Shop

  let factory: Factory

  let dao: Dao

  let signer: SignerWithAddress

  let privateExitModule: PrivateExitModule

  let launchpad: LaunchpadModule

  let usdc: Token

  let lp: LP

  beforeEach(async () => {
    signer = (await ethers.getSigners())[0]

    shop = await new Shop__factory(signer).deploy()

    const xdao = await new XDAO__factory(signer).deploy()

    factory = await new Factory__factory(signer).deploy(
      shop.address,
      xdao.address
    )

    await shop.setFactory(factory.address)

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    dao = Dao__factory.connect(await factory.daoAt(0), signer)

    privateExitModule = await new PrivateExitModule__factory(signer).deploy()

    launchpad = (await upgrades.deployProxy(
      await ethers.getContractFactory('LaunchpadModule')
    )) as LaunchpadModule

    launchpad.setCoreAddresses(
      factory.address,
      shop.address,
      privateExitModule.address
    )

    usdc = await new Token__factory(signer).deploy()
  })

  it('Init Sale', async () => {
    await expect(
      launchpad.initSale(
        constants.AddressZero,
        0,
        [false, false, false, false],
        0,
        0,
        new Array(10).fill(new Wallet(randomBytes(32).toString('hex')).address),
        new Array(10).fill(1),
        [constants.AddressZero]
      )
    ).to.be.revertedWith('LaunchpadModule: only for DAOs')
  })

  describe('With LP', () => {
    beforeEach(async () => {
      await executeTx(
        dao.address,
        shop.address,
        'createLp',
        ['string', 'string'],
        ['EgorLP', 'ELP'],
        0,
        signer
      )

      lp = LP__factory.connect(await dao.lp(), signer)

      await executeTxRaw(
        dao.address,
        shop.address,
        Shop__factory.createInterface().encodeFunctionData(
          'createPrivateOffer',
          [launchpad.address, usdc.address, constants.Zero, parseEther('20')]
        ),
        0,
        signer
      )
      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('0'))

      await launchpad.fillLpBalance(dao.address, 0)

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('20'))
    })

    it('Base Launchpad', async () => {
      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('2'),
            [false, false, false, false],
            0,
            0,
            [],
            [],
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('2'),
        false,
        false,
        false,
        false,
        constants.Zero,
        constants.Zero,
        [],
        []
      ])

      await usdc.approve(launchpad.address, parseEther('4'))

      await launchpad.buy(dao.address, parseEther('4'))

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther('2'))

      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther('96'))

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('18'))

      await expect(
        launchpad.buy(dao.address, parseEther('2'))
      ).to.be.revertedWith('LaunchpadModule: already bought')

      await executeTxRaw(
        dao.address,
        privateExitModule.address,
        PrivateExitModule__factory.createInterface().encodeFunctionData(
          'createPrivateExitOffer',
          [launchpad.address, parseEther('12'), constants.Zero, [], []]
        ),
        0,
        signer
      )

      await launchpad.burnLp(dao.address, 0)

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('6'))
    })

    it('Timestamp Launchpad', async () => {
      const timestamp = dayjs().unix()
      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [true, false, false, false],
            BigNumber.from(timestamp),
            0,
            [],
            [],
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        true,
        false,
        false,
        false,
        BigNumber.from(timestamp),
        constants.Zero,
        [],
        []
      ])

      await expect(
        launchpad.buy(dao.address, parseEther('2'))
      ).to.be.revertedWith('LaunchpadModule: sale is over')
    })

    it('Sale Limited Launchpad', async () => {
      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, true, false, false],
            0,
            parseEther('6'),
            [],
            [],
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        true,
        false,
        false,
        constants.Zero,
        parseEther('6'),
        [],
        []
      ])

      await expect(
        launchpad.buy(dao.address, parseEther('10'))
      ).to.be.revertedWith('LaunchpadModule: limit exceeded')

      await usdc.approve(launchpad.address, parseEther('3'))

      await launchpad.buy(dao.address, parseEther('3'))

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther('1'))

      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther('97'))

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('19'))

      await expect(launchpad.buy(dao.address, 0)).to.be.revertedWith(
        'LaunchpadModule: already bought'
      )
    })

    it('Whitelisted Launchpad: Add', async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => new Wallet(randomBytes(32).toString('hex')).address)

      await expect(
        executeTxRaw(
          dao.address,
          launchpad.address,
          LaunchpadModule__factory.createInterface().encodeFunctionData(
            'initSale',
            [
              usdc.address,
              parseEther('3'),
              [false, false, true, false],
              0,
              0,
              randomAddresses,
              [signer.address],
              []
            ]
          ),
          0,
          signer
        )
      ).to.be.revertedWith('LaunchpadModule: Invalid Whitelist Length')

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, false],
            0,
            0,
            randomAddresses,
            new Array(10).fill(0),
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses,
        new Array(10).fill(constants.Zero)
      ])

      await expect(
        launchpad.buy(dao.address, parseEther('1'))
      ).to.be.revertedWith('LaunchpadModule: the buyer is not whitelisted')

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, false],
            0,
            0,
            [signer.address],
            [0],
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses.concat(signer.address),
        new Array(11).fill(constants.Zero)
      ])

      await usdc.approve(launchpad.address, parseEther('3'))

      await launchpad.buy(dao.address, parseEther('3'))

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther('1'))

      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther('97'))

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('19'))

      await expect(launchpad.buy(dao.address, 0)).to.be.revertedWith(
        'LaunchpadModule: already bought'
      )
    })

    it('Whitelisted Launchpad: Remove', async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => new Wallet(randomBytes(32).toString('hex')).address)

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, false],
            0,
            0,
            randomAddresses.concat(signer.address),
            new Array(11).fill(0),
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses.concat(signer.address),
        new Array(11).fill(constants.Zero)
      ])

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, false],
            0,
            0,
            [],
            [],
            [signer.address]
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        false,
        constants.Zero,
        constants.Zero,
        randomAddresses,
        new Array(10).fill(constants.Zero)
      ])

      await expect(
        launchpad.buy(dao.address, parseEther('1'))
      ).to.be.revertedWith('LaunchpadModule: the buyer is not whitelisted')
    })

    it('Whitelisted Launchpad with Allocations', async () => {
      const randomAddresses = new Array(10)
        .fill(0)
        .map(() => new Wallet(randomBytes(32).toString('hex')).address)

      const allocations = new Array(10).fill(parseEther('1'))

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, true],
            0,
            0,
            randomAddresses,
            allocations,
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        true,
        constants.Zero,
        constants.Zero,
        randomAddresses,
        allocations
      ])

      await expect(launchpad.buy(dao.address, 0)).to.be.revertedWith(
        'LaunchpadModule: the buyer is not whitelisted'
      )

      await executeTxRaw(
        dao.address,
        launchpad.address,
        LaunchpadModule__factory.createInterface().encodeFunctionData(
          'initSale',
          [
            usdc.address,
            parseEther('3'),
            [false, false, true, true],
            0,
            0,
            [signer.address],
            [parseEther('6')],
            []
          ]
        ),
        0,
        signer
      )

      expect(await launchpad.getSaleInfo(dao.address, 0)).to.eql([
        usdc.address,
        parseEther('3'),
        false,
        false,
        true,
        true,
        constants.Zero,
        constants.Zero,
        randomAddresses.concat(signer.address),
        allocations.concat(parseEther('6'))
      ])

      await usdc.approve(launchpad.address, parseEther('6'))

      await launchpad.buy(dao.address, 0)

      expect(await lp.balanceOf(signer.address)).to.eql(parseEther('2'))

      expect(await usdc.balanceOf(signer.address)).to.eql(parseEther('94'))

      expect(await lp.balanceOf(launchpad.address)).to.eql(parseEther('18'))

      await expect(launchpad.buy(dao.address, 0)).to.be.revertedWith(
        'LaunchpadModule: already bought'
      )
    })

    afterEach(async () => {
      await executeTxRaw(
        dao.address,
        launchpad.address,
        createData('closeSale'),
        0,
        signer
      )
    })
  })
})
