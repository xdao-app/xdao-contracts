import { randomBytes } from 'crypto'
import { constants, Wallet } from 'ethers'
import { ethers } from 'hardhat'

import { LaunchpadModule__factory } from '../../typechain-types'

describe('Launchpad', () => {
  it('Full Cycle', async () => {
    const [signer] = await ethers.getSigners()

    const launchpad = await new LaunchpadModule__factory(signer).deploy(
      constants.AddressZero,
      constants.AddressZero,
      constants.AddressZero
    )

    await launchpad.initSale(
      constants.AddressZero,
      0,
      [false, false, false, false],
      0,
      0,
      new Array(10).fill(new Wallet(randomBytes(32).toString('hex')).address),
      new Array(10).fill(1),
      [constants.AddressZero]
    )

    console.log(await launchpad.getSaleInfo(signer.address, 0))
  })
})
