import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import dayjs from 'dayjs'
import { constants } from 'ethers'
import { verifyMessage } from 'ethers/lib/utils'
import { ethers, network } from 'hardhat'

import {
  AdvancedViewer,
  AdvancedViewer__factory,
  Dao__factory,
  DaoViewer,
  DaoViewer__factory,
  Factory,
  Factory__factory,
  Shop,
  Shop__factory,
  Token,
  Token__factory
} from '../../typechain-types'
import { createData, createTxHash } from '../utils'

describe('AdvancedViewer', () => {
  let shop: Shop

  let factory: Factory

  let token: Token

  let signers: SignerWithAddress[]

  let ownerAddress: string

  let daoViewer: DaoViewer

  let advancedViewer: AdvancedViewer

  afterEach(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })

  beforeEach(async () => {
    signers = await ethers.getSigners()

    ownerAddress = signers[0].address

    token = await new Token__factory(signers[0]).deploy()

    shop = await new Shop__factory(signers[0]).deploy()

    factory = await new Factory__factory(signers[0]).deploy(
      shop.address,
      token.address
    )

    await shop.setFactory(factory.address)

    daoViewer = await new DaoViewer__factory(signers[0]).deploy()

    advancedViewer = await new AdvancedViewer__factory(signers[0]).deploy(
      factory.address,
      daoViewer.address
    )
    await factory.create('FIRST', 'FIRST', 51, [ownerAddress], [10])
    await factory.create('SECOND', 'SECOND', 51, [ownerAddress], [10])
  })

  it('User Daos', async () => {
    const emptyAddressList: string[] = new Array(28).fill(
      '0x0000000000000000000000000000000000000000'
    )
    const result = [
      await factory.daoAt(0),
      await factory.daoAt(1),
      ...emptyAddressList
    ]

    expect(await advancedViewer.userDaos(0, 2, ownerAddress)).to.eql(result)

    await expect(advancedViewer.userDaos(0, 3, ownerAddress)).to.be.reverted

    await factory.create('THIRD', 'THIRD', 51, [ownerAddress], [10])

    const resultAfterThirdDao = [...result]
    resultAfterThirdDao[2] = await factory.daoAt(2)

    expect(await advancedViewer.userDaos(0, 3, ownerAddress)).to.eql(
      resultAfterThirdDao
    )

    const resultAfterDeleteFirst = resultAfterThirdDao.slice(1)
    resultAfterDeleteFirst[29] = '0x0000000000000000000000000000000000000000'

    expect(await advancedViewer.userDaos(1, 3, ownerAddress)).to.eql(
      resultAfterDeleteFirst
    )
  })

  it('Get Daos', async () => {
    expect(await advancedViewer.getDaos(0, 2)).to.be.eql([
      await factory.daoAt(0),
      await factory.daoAt(1)
    ])

    await expect(advancedViewer.getDaos(0, 3)).to.be.reverted

    await factory.create('THIRD', 'THIRD', 51, [ownerAddress], [10])

    expect(await advancedViewer.getDaos(0, 3)).to.be.eql([
      await factory.daoAt(0),
      await factory.daoAt(1),
      await factory.daoAt(2)
    ])

    expect(await advancedViewer.getDaos(1, 3)).to.eql([
      await factory.daoAt(1),
      await factory.daoAt(2)
    ])
  })

  it('Get Daos Info', async () => {
    expect(
      await advancedViewer.getDaosInfo([
        await factory.daoAt(0),
        await factory.daoAt(1)
      ])
    ).to.be.eql([
      [
        '0x75537828f2ce51be7289709686A69CbFDbB714F1',
        'FIRST',
        'FIRST',
        '0x0000000000000000000000000000000000000000',
        '',
        ''
      ],
      [
        '0xE451980132E65465d0a498c53f0b5227326Dd73F',
        'SECOND',
        'SECOND',
        '0x0000000000000000000000000000000000000000',
        '',
        ''
      ]
    ])
  })

  it('Get Daos Executed Voting', async () => {
    expect(
      await advancedViewer.getDaosExecutedVoting([
        await factory.daoAt(0),
        await factory.daoAt(1)
      ])
    ).to.be.eql([constants.Zero, constants.Zero])

    const timestamp = dayjs().unix()

    const voting = {
      target: await factory.daoAt(0),
      data: createData(
        'mint',
        ['address', 'uint256'],
        [signers[1].address, 10]
      ),
      value: 0,
      nonce: 0,
      timestamp
    }

    const txHash = createTxHash(
      voting.target,
      voting.target,
      voting.data,
      voting.value,
      voting.nonce,
      voting.timestamp,
      1337
    )

    const sig = await signers[0].signMessage(txHash)

    expect(verifyMessage(txHash, sig)).to.eq(ownerAddress)

    const dao = Dao__factory.connect(await factory.daoAt(0), signers[0])

    await dao.execute(
      voting.target,
      voting.data,
      voting.value,
      voting.nonce,
      voting.timestamp,
      [sig]
    )

    expect(
      await advancedViewer.getDaosExecutedVoting([
        await factory.daoAt(0),
        await factory.daoAt(1)
      ])
    ).to.be.eql([constants.One, constants.Zero])
  })
})
