import { BigNumberish } from "ethers"
import { AbiCoder, arrayify, id, keccak256 } from "ethers/lib/utils"

// createData('transfer', ['address','uint256'], ['0x000000000000000000000000000000000000dEaD', '100'])
// ===
// 0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000000064

export const createData = (
  func: string,
  argtypes: string[] = [],
  args: any[] = []
): string =>
  argtypes.length === 0 && args.length === 0
    ? id(`${func}()`).slice(0, 10) + new AbiCoder().encode([], []).slice(2)
    : id(`${func}(${argtypes.join(",")})`).slice(0, 10) +
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
          "address",
          "address",
          "bytes",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
        ],
        [daoAddress, target, data, value, nonce, timestamp, chainId]
      )
    )
  )
