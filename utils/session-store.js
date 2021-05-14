import { getDynamoKeyValueStore } from './dynamo-store'

const DYNAMO_TABLE_NAME_PREFIX = process.env.DYNAMO_TABLE_NAME_PREFIX || new Error('Missing setting')

export async function getSessionStore(defaultMaxAgeMS) {
  const dynamoStore = await getDynamoKeyValueStore(
    `${DYNAMO_TABLE_NAME_PREFIX}session`,
    { defaultMinutesToLive: Math.ceil(defaultMaxAgeMS / 1000 / 60)}
    
  )

  async function get(key, maxAge, { rolling, ctx }) {
    const doc = await dynamoStore.getItem(key)
    return doc?.session
  }

  async function set(key, sess, maxAge, { rolling, changed, ctx }) {
    await dynamoStore.putItem(
      key,
      { id: key, session: sess, timestamp: new Date().getTime(), maxAge },
      Math.ceil(maxAge / 1000)
    )
  }

  async function destroy(key, { ctx }) {
    await dynamoStore.removeItem(key)
  }

  return {
    get,
    set,
    destroy
  }
}
