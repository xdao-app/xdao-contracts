import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import dayjs from 'dayjs'
import { constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  NamedToken,
  NamedToken__factory,
  VestingModule
} from '../../typechain-types'

describe('VestingModule', () => {
  let vestingModule: VestingModule
  let token: NamedToken

  let owner: SignerWithAddress, claimer: SignerWithAddress

  const start = dayjs().add(1, 'day').unix()
  const duration = 1000

  beforeEach(async () => {
    const signers = await ethers.getSigners()

    owner = signers[0]
    claimer = signers[1]

    token = await new NamedToken__factory(owner).deploy('', '')

    vestingModule = (await upgrades.deployProxy(
      await ethers.getContractFactory('VestingModule'),
      [token.address, start, duration],
      {
        kind: 'uups'
      }
    )) as VestingModule

    await vestingModule.deployed()
  })

  it('Default Flow', async () => {
    expect(await vestingModule.totalAllocation(claimer.address)).to.eql(
      constants.Zero
    )

    await vestingModule.addAllocations([claimer.address], [parseEther('1')])
    await token.transfer(vestingModule.address, parseEther('2'))

    expect(await vestingModule.releasable(claimer.address)).to.eql(
      constants.Zero
    )

    await network.provider.send('evm_setNextBlockTimestamp', [start + 34])

    expect(await token.balanceOf(claimer.address)).to.eql(constants.Zero)

    await vestingModule.connect(claimer).release()

    expect(await token.balanceOf(claimer.address)).to.eql(parseEther('0.034'))
  })

  after(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })
})
