import { expect } from 'chai'
import { randomBytes } from 'crypto'
import dayjs from 'dayjs'
import { constants, Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

import {
  Dao__factory,
  Factory__factory,
  LaunchpadModule__factory,
  PrivateExitModule__factory,
  Shop__factory,
  Token__factory,
  XDAO__factory
} from '../../typechain-types'
import { createData, executeTx, executeTxRaw } from '../utils'

describe('Launchpad', () => {
  it('Full Cycle', async () => {
    const [signer] = await ethers.getSigners()

    const shop = await new Shop__factory(signer).deploy()

    const xdao = await new XDAO__factory(signer).deploy()

    const factory = await new Factory__factory(signer).deploy(
      shop.address,
      xdao.address
    )

    await shop.setFactory(factory.address)

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    const dao = Dao__factory.connect(await factory.daoAt(0), signer)

    const privateExitModule = await new PrivateExitModule__factory(
      signer
    ).deploy()

    const launchpad = await new LaunchpadModule__factory(signer).deploy(
      factory.address,
      shop.address,
      privateExitModule.address
    )

    const usdc = await new Token__factory(signer).deploy()

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

    await executeTx(
      dao.address,
      shop.address,
      'createLp',
      ['string', 'string'],
      ['EgorLP', 'ELP'],
      0,
      signer
    )

    await executeTxRaw(
      dao.address,
      launchpad.address,
      LaunchpadModule__factory.createInterface().encodeFunctionData(
        'initSale',
        [
          usdc.address,
          parseEther('2'),
          [true, true, true, true],
          dayjs().add(3, 'day').unix(),
          parseEther('12'),
          [signer.address],
          [parseEther('4.5')],
          []
        ]
      ),
      0,
      signer
    )

    await executeTxRaw(
      dao.address,
      shop.address,
      Shop__factory.createInterface().encodeFunctionData('createPrivateOffer', [
        launchpad.address,
        usdc.address,
        constants.Zero,
        parseEther('14')
      ]),
      0,
      signer
    )

    await launchpad.fillLpBalance(dao.address, 0)

    await usdc.approve(launchpad.address, parseEther('10'))

    await launchpad.buy(dao.address, 0)

    await executeTxRaw(
      dao.address,
      launchpad.address,
      createData('closeSale'),
      0,
      signer
    )

    await executeTxRaw(
      dao.address,
      privateExitModule.address,
      PrivateExitModule__factory.createInterface().encodeFunctionData(
        'createPrivateExitOffer',
        [launchpad.address, parseEther('11.75'), constants.Zero, [], []]
      ),
      0,
      signer
    )

    await launchpad.burnLp(dao.address, 0)
  })
})
