import { expect } from 'chai'
import { constants } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
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

    await factory.create('', '', 51, [signer.address], [parseEther('1')])

    const dao = Dao__factory.connect(await factory.daoAt(0), signer)

    const dividends = await new DividendsModule__factory(signer).deploy()

    await signer.sendTransaction({
      to: dao.address,
      value: parseEther('12')
    })

    await executeTx(
      dao.address,
      dividends.address,
      'distributeEther',
      ['address[]', 'uint256[]'],
      [[signer.address], [parseEther('1')]],
      parseEther('7.5'),
      signer
    )

    const usdc = await new Token__factory(signer).deploy()

    await usdc.transfer(dao.address, parseEther('1.2'))

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
      [usdc.address, [signer.address], [parseEther('1.2')]],
      0,
      signer
    )
  })
})
