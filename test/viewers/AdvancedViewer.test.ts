import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import {
  AdvancedViewer,
  AdvancedViewer__factory,
  Factory,
  Factory__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory
} from '../../typechain-types'

describe('AdvancedViewer', () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let signers: SignerWithAddress[]

  let ownerAddress: string

  let advancedViewer: AdvancedViewer

  it('Works Properly', async () => {
    signers = await ethers.getSigners()

    ownerAddress = signers[0].address

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    advancedViewer = await new AdvancedViewer__factory(signers[0]).deploy(
      factory.address
    )

    expect(await advancedViewer.userDaos(0, 0, ownerAddress)).to.be.an('array')
      .that.is.empty

    await factory.create('FIRST', 'FIRST', 51, [ownerAddress], [10])

    expect(await advancedViewer.userDaos(0, 1, ownerAddress)).to.eql([
      await factory.daoAt(0)
    ])
  })
})
