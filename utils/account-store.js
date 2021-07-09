import LRU from 'lru-cache'
import { getDynamoKeyValueStore } from './dynamo-store.js'

const DYNAMO_TABLE_NAME_PREFIX = process.env.DYNAMO_TABLE_NAME_PREFIX

export async function getAccountStore() {

  const accountStore = await getDynamoKeyValueStore(
    `${DYNAMO_TABLE_NAME_PREFIX}profile`,
    { partitionDataInBuckets: true }
  )
  const cache = new LRU({ max: 100000, maxAge: 10 * 60 * 1000}) //10 minute cache

  async function getItem(userKey, itemKey) {
    const cachedItem = cache.get(`${userKey}//${itemKey}`)
    if(cachedItem) {
      console.log(`Cache hit`)
      return cachedItem      
    }
    console.log(`Cache miss`)
    const item = await accountStore.getItem(userKey, itemKey)
    cache.set(`${userKey}//${itemKey}`, item)
    return item
  }

  async function putItem(userKey, itemKey, value) {
    cache.set(`${userKey}//${itemKey}`, value)

    return accountStore.putItem(userKey, itemKey, value)
  }

  return {
    getItem,
    putItem
  }
} 