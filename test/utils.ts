import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { AbiCoder, arrayify, id, keccak256 } from 'ethers/lib/utils'

import { Dao__factory } from '../typechain-types'

// createData('transfer', ['address','uint256'], ['0x000000000000000000000000000000000000dEaD', '100'])
// ===
// 0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000000064

export const createData = (
  func: string,
  argtypes: string[] = [],
  args: unknown[] = []
): string =>
  argtypes.length === 0 && args.length === 0
    ? id(`${func}()`).slice(0, 10) + new AbiCoder().encode([], []).slice(2)
    : id(`${func}(${argtypes.join(',')})`).slice(0, 10) +
      new AbiCoder().encode(argtypes, args).slice(2)

export const createTxHash = (
  daoAddress: string,
  target: string,
  data: string,
  value: BigNumberish,
  nonce: BigNumberish,
  timestamp: BigNumberish,
  chainId: BigNumberish
): Uint8Array =>
  arrayify(
    keccak256(
      new AbiCoder().encode(
        [
          'address',
          'address',
          'bytes',
          'uint256',
          'uint256',
          'uint256',
          'uint256'
        ],
        [daoAddress, target, data, value, nonce, timestamp, chainId]
      )
    )
  )

async function execute(
  daoAddress: string,
  targetAddress: string,
  data: string,
  value: BigNumberish,
  nonce: BigNumberish,
  signer: SignerWithAddress
) {
  const timestamp = Math.floor(Date.now() / 1000)

  await Dao__factory.connect(daoAddress, signer).execute(
    targetAddress,
    data,
    value,
    nonce,
    timestamp,
    [
      await signer.signMessage(
        createTxHash(
          daoAddress,
          targetAddress,
          data,
          value,
          nonce,
          timestamp,
          1337
        )
      )
    ]
  )
}

export const executeTx = async (
  daoAddress: string,
  targetAddress: string,
  func: string,
  argtypes: string[] = [],
  args: unknown[] = [],
  value: BigNumberish = 0,
  signer: SignerWithAddress
) => {
  await execute(
    daoAddress,
    targetAddress,
    createData(func, argtypes, args),
    value,
    0,
    signer
  )
}

export const executeTxRaw = async (
  daoAddress: string,
  targetAddress: string,
  data: string,
  value: BigNumberish = 0,
  signer: SignerWithAddress
) => {
  await execute(daoAddress, targetAddress, data, value, 0, signer)
}
