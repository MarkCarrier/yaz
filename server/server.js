import 'core-js/stable'
import 'regenerator-runtime/runtime'

import Koa from 'koa'
import session from 'koa-session'
import { getDynamoKeyValueStore } from '../utils/dynamo-store.js'
import { getSessionStore } from '../utils/session-store.js'
import { buildAppRouter } from './router'
const SERVICE_PORT = process.env.SERVICE_PORT || 4411
const SESSION_KEYS = process.env.SESSION_KEYS.split(',')
const DYNAMO_TABLE_NAME_PREFIX = process.env.DYNAMO_TABLE_NAME_PREFIX
async function buildApp() {
  const accountStore = await getDynamoKeyValueStore(
    `${DYNAMO_TABLE_NAME_PREFIX}profile`,
    { partitionDataInBuckets: true }
  )
  const sessionStore = await getSessionStore()

  const app = new Koa()
  //session keys
  app.keys = SESSION_KEYS
  const sessionConfig = {
    key: 'yaz.sess',
    maxAge: 90 * 24 * 60 * 60 * 1000, //90 day session
    store: sessionStore
  }
  app.use(session(sessionConfig, app))
  const appRouter = await buildAppRouter(accountStore)

  app.use(appRouter.routes()).use(appRouter.allowedMethods())

  return app
}

async function start() {
  const app = await buildApp()
  await app.listen(SERVICE_PORT)
  console.log(`Listening on ${SERVICE_PORT}`)
}

start().catch((serverErr) => {
  console.error('Top level server error', serverErr)
})
