import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  Dao,
  Dao__factory,
  Factory,
  Factory__factory,
  Shop,
  Shop__factory,
  SubscriptionManager,
  Token__factory,
  XDAO,
  XDAO__factory,
  XDAOQuestAwards,
  XDAOQuestAwards__factory
} from '../../typechain-types'

describe('SubscriptionManager', () => {
  let shop: Shop
  let factory: Factory
  let firstDao: Dao, secondDao: Dao

  let subscriptionManager: SubscriptionManager
  let xdaoToken: XDAO

  let xdaoAwards: XDAOQuestAwards

  let owner: SignerWithAddress,
    manager: SignerWithAddress,
    signer: SignerWithAddress,
    recipient: SignerWithAddress

  let MANAGER_ROLE: string

  after(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })

  beforeEach(async () => {
    const signers = await ethers.getSigners()

    owner = signers[0]
    manager = signers[1]
    signer = signers[2]
    recipient = signers[3]

    xdaoToken = await new XDAO__factory(owner).deploy()
    xdaoAwards = await new XDAOQuestAwards__factory(signer).deploy()

    await xdaoAwards.mintBatch(signer.address, [0, 1, 2], [10, 10, 10], '0x')
    await xdaoAwards.mintBatch(manager.address, [0, 1, 2], [10, 10, 10], '0x')

    shop = await new Shop__factory(signer).deploy()
    factory = await new Factory__factory(signer).deploy(
      shop.address,
      xdaoToken.address
    )

    await shop.setFactory(factory.address)
    await factory.create('', '', 51, [owner.address], [parseEther('1')])
    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    firstDao = Dao__factory.connect(await factory.daoAt(0), owner)
    secondDao = Dao__factory.connect(await factory.daoAt(1), owner)

    subscriptionManager = (await upgrades.deployProxy(
      await ethers.getContractFactory('SubscriptionManager'),
      [xdaoToken.address, recipient.address, BigNumber.from(2592000)]
    )) as SubscriptionManager

    await subscriptionManager.deployed()

    MANAGER_ROLE = await subscriptionManager.MANAGER_ROLE()
    await subscriptionManager.grantRole(MANAGER_ROLE, manager.address)
  })

  it('Roles Accessibility', async () => {
    await expect(
      subscriptionManager
        .connect(signer)
        .editMinDuration(BigNumber.from(1296000))
    ).to.be.reverted
    await expect(
      subscriptionManager.connect(signer).editRecipient(signer.address)
    ).to.be.reverted
    await expect(
      subscriptionManager
        .connect(signer)
        .editDurationPerToken(0, BigNumber.from(129600))
    ).to.be.reverted
    await expect(
      subscriptionManager
        .connect(signer)
        .editReceivableERC1155(
          xdaoAwards.address,
          0,
          0,
          BigNumber.from(2592000)
        )
    ).to.be.reverted
    await expect(
      subscriptionManager
        .connect(signer)
        .setSubscriptionStatus(1, firstDao.address, 0, BigNumber.from(2592000))
    ).to.be.reverted

    await expect(
      subscriptionManager
        .connect(manager)
        .editMinDuration(BigNumber.from(1296000))
    ).to.be.reverted
    await expect(
      subscriptionManager.connect(manager).editRecipient(manager.address)
    ).to.be.reverted
    await expect(
      subscriptionManager
        .connect(manager)
        .editDurationPerToken(0, BigNumber.from(129600))
    ).to.be.reverted

    await xdaoAwards
      .connect(manager)
      .setApprovalForAll(subscriptionManager.address, true)

    await expect(
      subscriptionManager
        .connect(manager)
        .editReceivableERC1155(
          xdaoAwards.address,
          0,
          0,
          BigNumber.from(2592000)
        )
    ).to.be.reverted

    const usdc = await new Token__factory(signer).deploy()

    await expect(subscriptionManager.connect(manager).editToken(usdc.address))
      .to.be.reverted

    await subscriptionManager
      .connect(owner)
      .editMinDuration(BigNumber.from(1296000))
    expect(await subscriptionManager.minDuration()).to.eql(
      BigNumber.from(1296000)
    )

    await subscriptionManager.connect(owner).editRecipient(owner.address)
    expect(await subscriptionManager.recipientAddress()).to.eql(owner.address)

    await subscriptionManager
      .connect(owner)
      .editDurationPerToken(0, BigNumber.from(129600))
    expect(await subscriptionManager.durationPerToken(0)).to.eql(
      BigNumber.from(129600)
    )

    await subscriptionManager
      .connect(owner)
      .editReceivableERC1155(xdaoAwards.address, 0, 0, BigNumber.from(2592000))
    const awardSubscription = await subscriptionManager.receivableERC1155(
      xdaoAwards.address,
      0
    )

    expect(awardSubscription.subscriptionLevel).to.eql(0)
    expect(awardSubscription.durationScaled).to.eql(parseEther('2592000'))

    await subscriptionManager
      .connect(manager)
      .setSubscriptionStatus(1, firstDao.address, 1, BigNumber.from(2592000))

    const firstDaoSubscription = await subscriptionManager.subscriptions(
      1,
      firstDao.address
    )
    expect(firstDaoSubscription.subscriptionLevel).to.eql(1)
    expect(firstDaoSubscription.endTimestampScaled).to.eql(
      parseEther('2592000')
    )

    await subscriptionManager.connect(owner).editToken(usdc.address)
    expect(await subscriptionManager.token()).to.eql(usdc.address)
  })

  describe('Payment', () => {
    beforeEach(async () => {
      await subscriptionManager
        .connect(owner)
        .editDurationPerToken(0, BigNumber.from(129600)) // 20 tokens per mo

      await subscriptionManager
        .connect(owner)
        .editDurationPerToken(1, BigNumber.from(51840)) // 50 tokens per mo
    })

    describe('Token Payment', () => {
      beforeEach(async () => {
        await xdaoToken
          .connect(owner)
          .approve(subscriptionManager.address, constants.MaxInt256)
      })

      it('Onetime Payment', async () => {
        await expect(
          subscriptionManager
            .connect(owner)
            .pay(1, firstDao.address, 2, parseEther('20'))
        ).to.be.revertedWith('SubscriptionManager: invalid subscription level')

        await expect(
          subscriptionManager
            .connect(owner)
            .pay(1, firstDao.address, 0, parseEther('19'))
        ).to.be.revertedWith(
          'SubscriptionManager: subscription durationScaled is too low'
        )

        await subscriptionManager
          .connect(owner)
          .pay(1, firstDao.address, 0, parseEther('20'))

        const firstPaymentBlockNumber = await ethers.provider.getBlockNumber()
        const firstPaymentTimestamp = (
          await ethers.provider.getBlock(firstPaymentBlockNumber)
        ).timestamp

        const firstDaoSubscription = await subscriptionManager.subscriptions(
          1,
          firstDao.address
        )

        expect(firstDaoSubscription.subscriptionLevel).to.be.eq(0)
        expect(firstDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther((2592000 + firstPaymentTimestamp).toString())
        )

        expect(await xdaoToken.balanceOf(recipient.address)).to.be.eq(
          parseEther('20')
        )

        await subscriptionManager
          .connect(owner)
          .pay(137, secondDao.address, 0, parseEther('40'))

        const secondPaymentBlockNumber = await ethers.provider.getBlockNumber()
        const secondPaymentTimestamp = (
          await ethers.provider.getBlock(secondPaymentBlockNumber)
        ).timestamp

        const secondDaoSubscription = await subscriptionManager.subscriptions(
          137,
          secondDao.address
        )

        expect(secondDaoSubscription.subscriptionLevel).to.be.eq(0)
        expect(secondDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther((2 * 2592000 + secondPaymentTimestamp).toString())
        )

        expect(
          (await subscriptionManager.subscriptions(1, secondDao.address))
            .endTimestampScaled
        ).to.be.eq(parseEther('0'))

        expect(
          (await subscriptionManager.subscriptions(137, firstDao.address))
            .endTimestampScaled
        ).to.be.eq(parseEther('0'))

        expect(firstDaoSubscription.subscriptionLevel).to.be.eq(0)
        expect(firstDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther((2592000 + firstPaymentTimestamp).toString())
        )

        expect(await xdaoToken.balanceOf(recipient.address)).to.be.eq(
          parseEther('60')
        )
      })

      it('Subscribtion Extension', async () => {
        await subscriptionManager
          .connect(owner)
          .pay(1, firstDao.address, 0, parseEther('20'))

        const blockNumber = await ethers.provider.getBlockNumber()
        const firstPaymentTimestamp = (
          await ethers.provider.getBlock(blockNumber)
        ).timestamp

        await network.provider.send('evm_setNextBlockTimestamp', [
          firstPaymentTimestamp + 2592000 / 2
        ])

        await subscriptionManager
          .connect(owner)
          .pay(1, firstDao.address, 1, parseEther('50'))

        const secondPaymentTimestamp = (
          await ethers.provider.getBlock(blockNumber + 1)
        ).timestamp

        expect(secondPaymentTimestamp - firstPaymentTimestamp).to.be.eq(
          2592000 / 2
        )

        const firstDaoSubscription = await subscriptionManager.subscriptions(
          1,
          firstDao.address
        )
        const expectingTimestamp = Math.round(
          (6 * 2592000) / 5 + secondPaymentTimestamp
        )

        expect(firstDaoSubscription.subscriptionLevel).to.be.eq(1)
        expect(firstDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther(expectingTimestamp.toString())
        )

        expect(await xdaoToken.balanceOf(recipient.address)).to.be.eq(
          parseEther('70')
        )

        await expect(
          subscriptionManager
            .connect(owner)
            .pay(1, firstDao.address, 0, parseEther('20'))
        ).to.be.revertedWith(
          "SubscriptionManager: subscription can't be downgraded"
        )
      })
    })

    describe('ERC1155 Payment', () => {
      beforeEach(async () => {
        await subscriptionManager.editReceivableERC1155(
          xdaoAwards.address,
          0,
          0,
          BigNumber.from(2592000)
        )

        await subscriptionManager.editReceivableERC1155(
          xdaoAwards.address,
          1,
          1,
          BigNumber.from(7776000)
        )

        await xdaoAwards
          .connect(signer)
          .setApprovalForAll(subscriptionManager.address, true)
      })

      it('Onetime Payment', async () => {
        await expect(
          subscriptionManager
            .connect(signer)
            .payWithERC1155(1, firstDao.address, xdaoAwards.address, 2)
        ).to.be.revertedWith('SubscriptionManager: unsupported ERC1155')

        await subscriptionManager
          .connect(signer)
          .payWithERC1155(1, firstDao.address, xdaoAwards.address, 0)

        const firstPaymentBlockNumber = await ethers.provider.getBlockNumber()
        const firstPaymentTimestamp = (
          await ethers.provider.getBlock(firstPaymentBlockNumber)
        ).timestamp

        const firstDaoSubscription = await subscriptionManager.subscriptions(
          1,
          firstDao.address
        )

        expect(firstDaoSubscription.subscriptionLevel).to.be.eq(0)
        expect(firstDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther((2592000 + firstPaymentTimestamp).toString())
        )

        expect(await xdaoAwards.balanceOf(recipient.address, 0)).to.be.eq(1)
      })

      it('Subscribtion Extension', async () => {
        await subscriptionManager
          .connect(signer)
          .payWithERC1155(1, firstDao.address, xdaoAwards.address, 0)

        const blockNumber = await ethers.provider.getBlockNumber()
        const firstPaymentTimestamp = (
          await ethers.provider.getBlock(blockNumber)
        ).timestamp

        await network.provider.send('evm_setNextBlockTimestamp', [
          firstPaymentTimestamp + 2592000 / 2
        ])

        await subscriptionManager
          .connect(signer)
          .payWithERC1155(1, firstDao.address, xdaoAwards.address, 1)

        const secondPaymentTimestamp = (
          await ethers.provider.getBlock(blockNumber + 1)
        ).timestamp

        expect(secondPaymentTimestamp - firstPaymentTimestamp).to.be.eq(
          2592000 / 2
        )

        const firstDaoSubscription = await subscriptionManager.subscriptions(
          1,
          firstDao.address
        )

        const expectingTimestamp = Math.round(
          7776000 + 2592000 / 5 + secondPaymentTimestamp
        )

        expect(firstDaoSubscription.subscriptionLevel).to.be.eq(1)
        expect(firstDaoSubscription.endTimestampScaled).to.be.eq(
          parseEther(expectingTimestamp.toString())
        )

        expect(await xdaoAwards.balanceOf(recipient.address, 0)).to.be.eq(1)
        expect(await xdaoAwards.balanceOf(recipient.address, 1)).to.be.eq(1)

        await expect(
          subscriptionManager
            .connect(signer)
            .payWithERC1155(1, firstDao.address, xdaoAwards.address, 0)
        ).to.be.revertedWith(
          "SubscriptionManager: subscription can't be downgraded"
        )
      })
    })
  })
})
