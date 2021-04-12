import { v4 as uuidv4 } from 'uuid'
import { binary_to_base58 } from 'base58-js'

export function getRandomIdString() {
  let binaryId = []
  uuidv4(null, binaryId)
  return binary_to_base58(binaryId)
}

export function getLongRandomIdString(l = 2) {
  return new Array(l)
    .fill(null)
    .map((n) => getRandomIdString())
    .join('')
}
