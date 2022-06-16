import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  SymbiosisBridge,
  SymbiosisRouter,
  SymbiosisRouter__factory,
  Token,
  Token__factory
} from '../../typechain-types'
import { SymbiosisRouterGateway__factory } from '../../typechain-types/factories/SymbiosisRouterGateway__factory'
import { SymbiosisRouterGateway } from '../../typechain-types/SymbiosisRouterGateway'

describe('Symbiosis Bridge', () => {
  let signer: SignerWithAddress,
    feeCollector: SignerWithAddress,
    feeCollectorAddress: string

  let symbiosisRouter: SymbiosisRouter
  let symbiosisRouterGateway: SymbiosisRouterGateway
  let symbiosisBridge: SymbiosisBridge

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

    symbiosisRouterGateway = await new SymbiosisRouterGateway__factory(
      signer
    ).deploy()

    symbiosisRouter = await new SymbiosisRouter__factory(signer).deploy(
      symbiosisRouterGateway.address
    )

    await symbiosisRouter.deployed()

    symbiosisBridge = (await upgrades.deployProxy(
      await ethers.getContractFactory('SymbiosisBridge'),
      [
        symbiosisRouter.address,
        symbiosisRouterGateway.address,
        FEE_RATE,
        feeCollectorAddress
      ]
    )) as SymbiosisBridge

    await symbiosisBridge.deployed()

    token = await new Token__factory(signer).deploy()
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
})
