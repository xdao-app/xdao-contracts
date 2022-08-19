import dayjs from 'dayjs'
import * as dotenv from 'dotenv'
import { parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import { executeTx } from '../../test/utils'
import {
  DaoViewer__factory,
  DividendsModule__factory,
  DocumentSign,
  Factory__factory,
  LaunchpadModule,
  NamedToken__factory,
  PayrollModule,
  PrivateExitModule__factory,
  Shop__factory,
  XDAO__factory
} from '../../typechain-types'

dotenv.config()

async function main() {
  await network.provider.request({ method: 'hardhat_reset', params: [] })

  const [signer, friend] = await ethers.getSigners()

  const shop = await new Shop__factory(signer).deploy()

  console.log('Shop:', shop.address)

  const xdaoToken = await new XDAO__factory(signer).deploy()

  console.log('XDAO Token:', xdaoToken.address)

  const factory = await new Factory__factory(signer).deploy(
    shop.address,
    xdaoToken.address
  )

  console.log('Factory:', factory.address)

  console.log('Setting Factory Address to Shop')

  await shop.setFactory(factory.address)

  console.log('Success: Setting Factory Address to Shop')

  const daoViewer = await new DaoViewer__factory(signer).deploy()

  console.log('Dao Viewer:', daoViewer.address)

  await factory.create(
    'AloneDAO',
    'ALONE',
    51,
    [signer.address],
    [parseEther('10')]
  )

  await factory.create(
    'FriendsDAO',
    'FRIENDS',
    51,
    [signer.address, friend.address],
    [parseEther('10'), parseEther('10')]
  )

  await factory.create(
    'WithLP',
    'WITHLP',
    51,
    [signer.address],
    [parseEther('10')]
  )

  await factory.create(
    'PrivateDAO',
    'PRIVATE',
    51,
    [signer.address],
    [parseEther('10')]
  )

  await factory.create(
    'PublicDAO',
    'PUBLIC',
    51,
    [signer.address],
    [parseEther('10')]
  )

  await factory.create(
    'ComplexDAO',
    'COMPLEX',
    51,
    [signer.address],
    [parseEther('10')]
  )

  console.log('Deployed 6 DAOs')

  const usdc = await new NamedToken__factory(signer).deploy('USDC', 'USDC')

  console.log('USDC Token:', usdc.address)

  const btc = await new NamedToken__factory(signer).deploy('BTC', 'BTC')

  console.log('BTC Token:', btc.address)

  const sol = await new NamedToken__factory(signer).deploy('SOL', 'SOL')

  console.log('SOL Token:', sol.address)

  for (const i of [2, 3, 4, 5]) {
    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'createLp',
      ['string', 'string'],
      ['LP', 'LP'],
      0,
      signer
    )
  }

  for (const i of [3, 5]) {
    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'createPrivateOffer',
      ['address', 'address', 'uint256', 'uint256'],
      [
        signer.address,
        [usdc, btc, sol][i - 3].address,
        parseEther('1.6'),
        parseEther('3.5')
      ],
      0,
      signer
    )

    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'createPrivateOffer',
      ['address', 'address', 'uint256', 'uint256'],
      [
        friend.address,
        [usdc, btc, sol][5 - i].address,
        parseEther('1.7'),
        parseEther('3.9')
      ],
      0,
      signer
    )

    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'createPrivateOffer',
      ['address', 'address', 'uint256', 'uint256'],
      [
        signer.address,
        [usdc, btc, sol][5 - i].address,
        parseEther('2.6'),
        parseEther('4.2')
      ],
      0,
      signer
    )

    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'disablePrivateOffer',
      ['uint256'],
      [2],
      0,
      signer
    )
  }

  for (const i of [4, 5]) {
    await executeTx(
      await factory.daoAt(i),
      shop.address,
      'initPublicOffer',
      ['bool', 'address', 'uint256'],
      ['true', [usdc, btc, sol][i - 4].address, parseEther('1.5')],
      0,
      signer
    )
  }

  const privateExitModule = await new PrivateExitModule__factory(
    signer
  ).deploy()

  console.log('PrivateExitModule:', privateExitModule.address)

  const dividendsModule = await new DividendsModule__factory(signer).deploy()

  console.log('DividendsModule:', dividendsModule.address)

  const launchpadModule = (await upgrades.deployProxy(
    await ethers.getContractFactory('LaunchpadModule')
  )) as LaunchpadModule

  await launchpadModule.setCoreAddresses(
    factory.address,
    shop.address,
    privateExitModule.address
  )

  console.log('LaunchpadModule:', launchpadModule.address)

  await executeTx(
    await factory.daoAt(5),
    launchpadModule.address,
    'initSale',
    [
      'address',
      'uint256',
      'bool[4]',
      'uint256',
      'uint256',
      'address[]',
      'uint256[]',
      'address[]'
    ],
    [
      usdc.address,
      parseEther('2'),
      [true, true, true, true],
      dayjs().add(3, 'day').unix(),
      parseEther('12'),
      [signer.address, friend.address],
      [parseEther('1.4'), parseEther('2.7')],
      []
    ],
    0,
    signer
  )

  const payrollModule = (await upgrades.deployProxy(
    await ethers.getContractFactory('PayrollModule'),
    [factory.address]
  )) as PayrollModule

  console.log('PayrollModule:', payrollModule.address)

  const documentSignModule = (await upgrades.deployProxy(
    await ethers.getContractFactory('DocumentSign'),
    [factory.address]
  )) as DocumentSign

  console.log('DocumentSignModule:', documentSignModule.address)

  console.log('Done')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
