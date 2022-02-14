import { expect } from 'chai'
import { randomBytes } from 'crypto'
import { constants, Wallet } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

import {
  Dao__factory,
  DividendsModule__factory,
  Factory__factory,
  Token__factory
} from '../../typechain-types'
import { executeTx } from '../utils'

describe('Dividends', () => {
  it('Full Cycle', async () => {
    const [signer] = await ethers.getSigners()

    const friendAddress = new Wallet(randomBytes(32).toString('hex')).address

    const factory = await new Factory__factory(signer).deploy(
      constants.AddressZero,
      constants.AddressZero
    )

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    const dao = Dao__factory.connect(await factory.daoAt(0), signer)

    const dividends = await new DividendsModule__factory(signer).deploy()

    await signer.sendTransaction({
      to: dao.address,
      value: parseEther('12')
    })

    expect(
      await Promise.all([
        ethers.provider.getBalance(dao.address),
        ethers.provider.getBalance(friendAddress)
      ])
    ).to.eql([parseEther('12'), constants.Zero])

    await executeTx(
      dao.address,
      dividends.address,
      'distributeEther',
      ['address[]', 'uint256[]'],
      [[friendAddress], [parseEther('1')]],
      parseEther('7.5'),
      signer
    )

    expect(
      await Promise.all([
        ethers.provider.getBalance(dao.address),
        ethers.provider.getBalance(friendAddress)
      ])
    ).to.eql([parseEther('11'), parseEther('1')])

    const usdc = await new Token__factory(signer).deploy()

    await usdc.transfer(dao.address, parseEther('3'))

    expect(
      await Promise.all([
        usdc.balanceOf(dao.address),
        usdc.balanceOf(friendAddress)
      ])
    ).to.eql([parseEther('3'), constants.Zero])

    await executeTx(
      dao.address,
      usdc.address,
      'approve',
      ['address', 'uint256'],
      [dividends.address, parseEther('1.2')],
      0,
      signer
    )

    await executeTx(
      dao.address,
      dividends.address,
      'distributeTokens',
      ['address', 'address[]', 'uint256[]'],
      [usdc.address, [friendAddress], [parseEther('1.2')]],
      0,
      signer
    )

    expect(
      await Promise.all([
        usdc.balanceOf(dao.address),
        usdc.balanceOf(friendAddress)
      ])
    ).to.eql([parseEther('1.8'), parseEther('1.2')])
  })
})
