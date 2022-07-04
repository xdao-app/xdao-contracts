import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  SymbiosisBridge,
  SymbiosisBridgeV1,
  SymbiosisRouter,
  SymbiosisRouter__factory,
  Token,
  Token__factory
} from '../../typechain-types'
import { SymbiosisRouterGateway__factory } from '../../typechain-types/factories/SymbiosisRouterGateway__factory'
import { SymbiosisRouterGateway } from '../../typechain-types/SymbiosisRouterGateway'

const ACCESS_DENIED_MESSAGE =
  'SymbiosisBridge: Only Owner can call this function'

describe('Symbiosis Bridge', () => {
  let signer: SignerWithAddress,
    feeCollector: SignerWithAddress,
    feeCollectorAddress: string,
    somebody: SignerWithAddress,
    owner: string

  let symbiosisRouter: SymbiosisRouter
  let symbiosisRouterGateway: SymbiosisRouterGateway
  let symbiosisBridgeV1: SymbiosisBridgeV1, symbiosisBridge: SymbiosisBridge

  let token: Token

  const symbiosisRouterEncoder = SymbiosisRouter__factory.createInterface()

  const FEE_RATE = 1

  after(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })

  beforeEach(async () => {
    const signers = await ethers.getSigners()

    signer = signers[0]
    feeCollector = signers[1]
    feeCollectorAddress = feeCollector.address
    somebody = signers[2]

    owner = signer.address

    symbiosisRouterGateway = await new SymbiosisRouterGateway__factory(
      signer
    ).deploy()

    symbiosisRouter = await new SymbiosisRouter__factory(signer).deploy(
      symbiosisRouterGateway.address
    )

    await symbiosisRouter.deployed()

    symbiosisBridgeV1 = (await upgrades.deployProxy(
      await ethers.getContractFactory('SymbiosisBridgeV1'),
      [
        symbiosisRouter.address,
        symbiosisRouterGateway.address,
        feeCollectorAddress,
        FEE_RATE
      ]
    )) as SymbiosisBridgeV1

    await symbiosisBridgeV1.deployed()

    symbiosisBridge = (await upgrades.upgradeProxy(
      symbiosisBridgeV1,
      await ethers.getContractFactory('SymbiosisBridge'),
      { call: { fn: 'setOwner', args: [owner] } }
    )) as SymbiosisBridge

    token = await new Token__factory(signer).deploy()
  })

  it('Check Owner', async () => {
    expect(await symbiosisBridge.owner()).to.be.eq(owner)

    await expect(symbiosisBridge.setOwner(somebody.address)).to.be.revertedWith(
      'SymbiosisBridge: The Owner already set'
    )
  })

  it('Swap Token', async () => {
    const fromTokenAmount = parseEther('1.3')

    const feeAmount = fromTokenAmount.mul(FEE_RATE).div(10000)
    const swapAmount = fromTokenAmount.sub(feeAmount)

    expect(
      await Promise.all([
        token.balanceOf(signer.address),
        token.balanceOf(feeCollectorAddress),
        token.balanceOf(symbiosisRouterGateway.address)
      ])
    ).to.be.eql([parseEther('100'), constants.Zero, constants.Zero])

    await expect(
      symbiosisBridge.swapToken(
        token.address,
        fromTokenAmount,
        symbiosisRouterEncoder.encodeFunctionData('mockSwapToken', [
          token.address,
          swapAmount
        ])
      )
    ).to.be.revertedWith('ERC20: insufficient allowance')

    await token.approve(symbiosisBridge.address, constants.MaxUint256)

    await symbiosisBridge.swapToken(
      token.address,
      fromTokenAmount,
      symbiosisRouterEncoder.encodeFunctionData('mockSwapToken', [
        token.address,
        swapAmount
      ])
    )

    expect(
      await Promise.all([
        token.balanceOf(signer.address),
        token.balanceOf(feeCollectorAddress),
        token.balanceOf(symbiosisRouterGateway.address)
      ])
    ).to.be.eql([parseEther('100').sub(fromTokenAmount), feeAmount, swapAmount])
  })

  it('Swap ETH', async () => {
    const fromEthAmount = parseEther('1.3')

    const feeAmount = fromEthAmount.mul(FEE_RATE).div(10000)
    const swapAmount = fromEthAmount.sub(feeAmount)

    await expect(
      await symbiosisBridge.swapEth(
        symbiosisRouterEncoder.encodeFunctionData('mockSwapEth', [swapAmount]),
        { value: fromEthAmount }
      )
    ).to.changeEtherBalances(
      [signer, feeCollector, symbiosisRouterGateway],
      [fromEthAmount.mul(-1), feeAmount, swapAmount]
    )
  })

  it('Test Calculate Amounts', async () => {
    expect(await symbiosisBridge.calculateAmounts(parseEther('1.3'))).to.be.eql(
      [parseEther('0.00013'), parseEther('1.3').sub(parseEther('0.00013'))]
    )
  })

  it('Set MetaRouters', async () => {
    expect(
      await Promise.all([
        symbiosisBridge.metaRouter(),
        symbiosisBridge.metaRouterGateway()
      ])
    ).to.be.eql([symbiosisRouter.address, symbiosisRouterGateway.address])

    await expect(
      symbiosisBridge
        .connect(somebody)
        .setMetaRouters(somebody.address, somebody.address)
    ).to.be.revertedWith(ACCESS_DENIED_MESSAGE)

    await symbiosisBridge.setMetaRouters(somebody.address, somebody.address)

    expect(
      await Promise.all([
        symbiosisBridge.metaRouter(),
        symbiosisBridge.metaRouterGateway()
      ])
    ).to.be.eql([somebody.address, somebody.address])
  })

  it('Withdraw Bridge Asset Token', async () => {
    const stuckedTokenAmount = parseEther('23.45')

    await expect(() =>
      token.transfer(symbiosisBridge.address, stuckedTokenAmount)
    ).to.changeTokenBalances(
      token,
      [symbiosisBridge, signer],
      [stuckedTokenAmount, stuckedTokenAmount.mul(-1)]
    )

    await expect(
      symbiosisBridge
        .connect(somebody)
        .withdrawBridgeAssetToken(
          token.address,
          signer.address,
          stuckedTokenAmount
        )
    ).to.be.revertedWith(ACCESS_DENIED_MESSAGE)

    await expect(() =>
      symbiosisBridge.withdrawBridgeAssetToken(
        token.address,
        signer.address,
        stuckedTokenAmount
      )
    ).to.changeTokenBalances(
      token,
      [symbiosisBridge, signer],
      [stuckedTokenAmount.mul(-1), stuckedTokenAmount]
    )
  })

  it('Withdraw Bridge Asset Eth', async () => {
    const stuckedAmount = parseEther('23.45')

    await network.provider.send('hardhat_setBalance', [
      symbiosisBridge.address,
      stuckedAmount.toHexString().replace('0x0', '0x')
    ])

    await expect(
      symbiosisBridge
        .connect(somebody)
        .withdrawBridgeAssetEth(signer.address, stuckedAmount)
    ).to.be.revertedWith(ACCESS_DENIED_MESSAGE)

    await expect(() =>
      symbiosisBridge.withdrawBridgeAssetEth(signer.address, stuckedAmount)
    ).to.changeEtherBalances(
      [signer, symbiosisBridge],
      [stuckedAmount, stuckedAmount.mul(-1)]
    )
  })
})
