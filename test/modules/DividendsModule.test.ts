import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import {
  Dao__factory,
  DividendsModule__factory,
  Factory__factory,
  Token__factory
} from '../../typechain-types'
import { executeTx } from '../utils'

describe('Dividends', () => {
  it('Dividens', async () => {
    const [signer] = await ethers.getSigners()

    const factory = await new Factory__factory(signer).deploy(
      constants.AddressZero,
      constants.AddressZero
    )

    await factory.create('', '', 51, [signer.address], [1])

    const dao = Dao__factory.connect(await factory.daoAt(0), signer)

    const dividends = await new DividendsModule__factory(signer).deploy()

    await executeTx(
      dao.address,
      dao.address,
      'addPermitted',
      ['address'],
      [dividends.address],
      0,
      signer
    )

    expect(await dao.containsPermitted(dividends.address)).to.eq(true)

    const usdc = await new Token__factory(signer).deploy()

    await usdc.transfer(dao.address, 1)

    await executeTx(
      dao.address,
      usdc.address,
      'approve',
      ['address', 'uint256'],
      [dividends.address, 1],
      0,
      signer
    )

    await executeTx(
      dao.address,
      dividends.address,
      'distributeTokens',
      ['address', 'address[]', 'uint256[]'],
      [usdc.address, [signer.address], [1]],
      0,
      signer
    )
  })
})
