import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import dayjs from 'dayjs'
import { BigNumberish, constants } from 'ethers'
import { BytesLike, parseEther } from 'ethers/lib/utils'
import { ethers, network, upgrades } from 'hardhat'

import {
  Dao,
  Dao__factory,
  DocumentSignModule,
  DocumentSignModule__factory,
  Factory,
  Factory__factory,
  Shop,
  Shop__factory,
  XDAO__factory
} from '../../typechain-types'
import { createTxHash } from '../utils'

describe('DocumentSignModule', () => {
  let shop: Shop

  let factory: Factory

  let dao: Dao

  let documentSignModule: DocumentSignModule

  let signerOwnerA: SignerWithAddress,
    signerOwnerB: SignerWithAddress,
    signerOwnerC: SignerWithAddress,
    anotherSigner: SignerWithAddress

  const documentHash =
    '0x74b88e1fa4abd009f568790843b2e217720522f12695bd4522d7f63d5b9b6655'
  const wrongDocumentHash =
    '0xd340b14bfd93c57f48399bc37c8cac4020e0a32e326216fe275d841bddc866f8'

  const createDocument = async (
    args: [BytesLike, BigNumberish, BigNumberish, boolean],
    timestamp: number
  ) => {
    const voting = {
      target: documentSignModule.address,
      data: DocumentSignModule__factory.createInterface().encodeFunctionData(
        'createDocument',
        args
      ),
      value: 0,
      nonce: 0,
      timestamp
    }

    const txHash = createTxHash(
      dao.address,
      voting.target,
      voting.data,
      voting.value,
      voting.nonce,
      voting.timestamp,
      1337
    )

    const sigOwnerA = await signerOwnerA.signMessage(txHash)
    const sigOwnerB = await signerOwnerB.signMessage(txHash)
    const sigOwnerC = await signerOwnerC.signMessage(txHash)

    await dao.execute(
      voting.target,
      voting.data,
      voting.value,
      voting.nonce,
      voting.timestamp,
      [sigOwnerA, sigOwnerB, sigOwnerC]
    )
  }

  afterEach(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] })
  })

  beforeEach(async () => {
    const signers = await ethers.getSigners()

    signerOwnerA = signers[0]
    signerOwnerB = signers[1]
    signerOwnerC = signers[2]
    anotherSigner = signers[3]

    shop = await new Shop__factory(signerOwnerA).deploy()

    const xdao = await new XDAO__factory(signerOwnerA).deploy()

    factory = await new Factory__factory(signerOwnerA).deploy(
      shop.address,
      xdao.address
    )

    await shop.setFactory(factory.address)

    await factory.create(
      '',
      '',
      51,
      [signerOwnerA.address, signerOwnerB.address, signerOwnerC.address],
      [parseEther('10'), parseEther('10'), parseEther('10')]
    )

    dao = Dao__factory.connect(await factory.daoAt(0), signerOwnerA)

    documentSignModule = (await upgrades.deployProxy(
      await ethers.getContractFactory('DocumentSignModule'),
      [factory.address]
    )) as DocumentSignModule
  })

  it('Create and Sign Document with 100% GT holders signs', async () => {
    expect(
      await documentSignModule.getDocumentsHashesListLength(dao.address)
    ).to.be.eq(constants.Zero)

    const timeBase = dayjs()
    const timestamp = timeBase.unix()
    const effectiveDate = timeBase.add(3, 'day').unix()

    await createDocument([documentHash, effectiveDate, 0, false], timestamp)

    expect(
      await documentSignModule.getDocumentsHashesListLength(dao.address)
    ).to.be.eq(constants.One)

    expect(await documentSignModule.documentsHashes(dao.address, 0)).to.be.eq(
      documentHash
    )

    await expect(
      createDocument(
        [documentHash, effectiveDate, 0, false],
        timeBase.add(1, 'second').unix()
      )
    ).to.be.revertedWith('DocumentSignModule: The same Document already exists')

    await documentSignModule
      .connect(signerOwnerA)
      .signDocument(dao.address, documentHash)

    const documentWithFirstSign =
      await documentSignModule.getDocumentInfoByHash(dao.address, documentHash)

    expect(documentWithFirstSign.signedByAddresses).to.be.eql([
      signerOwnerA.address
    ])

    expect(documentWithFirstSign.isSigned).to.be.eq(false)

    await expect(
      documentSignModule
        .connect(signerOwnerA)
        .signDocument(dao.address, documentHash)
    ).to.be.revertedWith(
      'DocumentSignModule: Message sender already signed the document'
    )

    await expect(
      documentSignModule
        .connect(anotherSigner)
        .signDocument(dao.address, documentHash)
    ).to.be.revertedWith(
      'DocumentSignModule: Only GT holders is able to sign the document'
    )

    await documentSignModule
      .connect(signerOwnerB)
      .signDocument(dao.address, documentHash)

    await documentSignModule
      .connect(signerOwnerC)
      .signDocument(dao.address, documentHash)

    const signedDocument = await documentSignModule.getDocumentInfoByHash(
      dao.address,
      documentHash
    )

    expect(signedDocument.signedByAddresses).to.be.eql([
      signerOwnerA.address,
      signerOwnerB.address,
      signerOwnerC.address
    ])

    expect(signedDocument.isSigned).to.be.eq(true)

    await expect(
      documentSignModule
        .connect(signerOwnerA)
        .signDocument(dao.address, documentHash)
    ).to.be.revertedWith('DocumentSignModule: The Document already signed')
  })

  it('Create and Sign Document with DAO quorum signs', async () => {
    const timeBase = dayjs()
    const timestamp = timeBase.unix()
    const effectiveDate = timeBase.add(3, 'day').unix()

    await createDocument([documentHash, effectiveDate, 0, true], timestamp)

    const signedQuorumDocument =
      await documentSignModule.getDocumentInfoByIndex(dao.address, 0)

    expect(signedQuorumDocument.isSigned).to.be.eq(true)

    await expect(
      documentSignModule
        .connect(signerOwnerA)
        .signDocument(dao.address, documentHash)
    ).to.be.revertedWith('DocumentSignModule: The Document already signed')
  })

  it('Getters', async () => {
    const timeBase = dayjs()
    const timestamp = timeBase.unix()
    const effectiveDate = timeBase.add(3, 'day').unix()

    await createDocument([documentHash, effectiveDate, 0, true], timestamp)

    const documentByHashRight = await documentSignModule.getDocumentInfoByHash(
      dao.address,
      documentHash
    )
    const documentByHashWrong = await documentSignModule.getDocumentInfoByHash(
      dao.address,
      wrongDocumentHash
    )

    expect(documentByHashRight.fileHash).to.be.eq(documentHash)
    expect(documentByHashWrong.fileHash).to.be.eq(constants.HashZero)

    const documentByIndexRight =
      await documentSignModule.getDocumentInfoByIndex(dao.address, 0)

    expect(documentByIndexRight.fileHash).to.be.eq(documentHash)
    await expect(documentSignModule.getDocumentInfoByIndex(dao.address, 1)).to
      .be.reverted

    const documenList = await documentSignModule.getDocumentsInfoList(
      dao.address
    )

    expect(documenList[0].fileHash).to.be.eq(documentHash)
    expect(documenList[1]).to.be.eq(undefined)
  })

  it('Other Create Document Reverts', async () => {
    const timeBase = dayjs()

    await expect(
      createDocument(
        [documentHash, timeBase.subtract(100, 'second').unix(), 0, false],
        timeBase.unix()
      )
    ).to.be.revertedWith('DocumentSignModule: Effective date can`t be in past')

    await expect(
      createDocument(
        [
          documentHash,
          timeBase.add(60, 'second').unix(),
          timeBase.add(59, 'second').unix(),
          false
        ],
        timeBase.add(60, 'second').unix()
      )
    ).to.be.revertedWith(
      'DocumentSignModule: Expired date must be greater than effective date'
    )
  })

  it('Other Sign Document Reverts', async () => {
    await expect(
      documentSignModule.signDocument(dao.address, wrongDocumentHash)
    ).to.be.revertedWith('DocumentSignModule: The Document is not exist')

    const timeBase = dayjs()

    await createDocument(
      [documentHash, timeBase.add(1, 'minute').unix(), 0, false],
      timeBase.add(1, 'minute').unix()
    )

    await network.provider.send('evm_setNextBlockTimestamp', [
      timeBase.add(2, 'minute').unix()
    ])

    await expect(
      documentSignModule.signDocument(dao.address, documentHash)
    ).to.be.revertedWith(
      "DocumentSignModule: You can't sign the document after effective date"
    )
  })
})
