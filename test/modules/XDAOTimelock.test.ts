import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import dayjs from 'dayjs'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'

import {
  Token,
  Token__factory,
  XDAOTimelock,
  XDAOTimelock__factory
} from '../../typechain-types'

describe('XDAOTimelock', () => {
  let token: Token

  let timelock: XDAOTimelock

  let signers: SignerWithAddress[]

  let ownerAddress: string

  let timestamps: number[]

  let amounts: BigNumber[]

  beforeEach(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })

    signers = await ethers.getSigners()

    ownerAddress = signers[0].address

    token = await new Token__factory(signers[0]).deploy()

    const date = dayjs()

    timestamps = [
      date.subtract(2, 'day').unix(),
      date.subtract(1, 'day').unix(),
      date.subtract(1, 'minute').unix(),
      date.add(1, 'day').unix(),
      date.add(2, 'year').unix()
    ]

    amounts = [
      parseEther('2'),
      parseEther('4'),
      parseEther('6'),
      parseEther('1'),
      parseEther('7')
    ]

    timelock = await new XDAOTimelock__factory(signers[0]).deploy(
      token.address,
      ownerAddress,
      timestamps,
      amounts
    )

    await token.transfer(timelock.address, parseEther('22'))
  })

  it('Timelock Flow', async () => {
    expect(await timelock.unlocks())
      .to.eq((await timelock.getState())[2])
      .to.eq(0)

    const balances = async (addresses: string[]) =>
      await Promise.all(addresses.map((address) => token.balanceOf(address)))

    expect(await balances([ownerAddress, timelock.address])).to.eql([
      parseEther('78'),
      parseEther('22')
    ])

    for (const i of [0, 1, 2]) {
      expect(await timelock.unlocks()).to.eq(i)

      await expect(timelock.release).to.changeTokenBalances(
        token,
        [signers[0], timelock],
        [amounts[i], amounts[i].mul(-1)]
      )

      expect(await timelock.unlocks()).to.eq(i + 1)
    }

    expect(await balances([ownerAddress, timelock.address])).to.eql([
      parseEther('90'),
      parseEther('10')
    ])

    await expect(timelock.release()).to.be.revertedWith('Too early')
  })
})
