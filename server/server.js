import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Koa from 'koa'
import session from 'koa-session'
import { getSessionStore } from '../utils/session-store.js'
import { getAccountStore } from '../utils/account-store.js'
import { buildAppRouter } from './router'

const SERVICE_PORT = process.env.SERVICE_PORT || 4411
const SESSION_KEYS = process.env.SESSION_KEYS.split(',')

async function buildApp() {
  
  const accountStore = await getAccountStore() 
  const sessionStore = await getSessionStore()

  const app = new Koa()
  //session keys
  app.keys = SESSION_KEYS
  const sessionConfig = {
    key: 'yaz.sess',
    maxAge: 90 * 24 * 60 * 60 * 1000, //90 day session
    store: sessionStore
  }
  app.use(logTopLevelRequest)
  app.use(session(sessionConfig, app))
  const appRouter = await buildAppRouter(accountStore)

  app.use(appRouter.routes()).use(appRouter.allowedMethods())

  return app
}

async function logTopLevelRequest(ctx, next) {
  console.log('REQUEST START: %s %s %s', ctx.host, ctx.method, ctx.url)
  const start = new Date()
  await next()
  const ms = new Date() - start
    console.log(
      'REQUEST END: %s %s %s - %sms',
      ctx.host,
      ctx.method,
      ctx.url,
      ms
    )
}

async function start() {
  const app = await buildApp()
  await app.listen(SERVICE_PORT)
  console.log(`Listening on ${SERVICE_PORT}`)
}

start().catch((serverErr) => {
  console.error('Top level server error', serverErr)
})
