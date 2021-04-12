import Koa from 'koa'
import Router from 'koa-router'
import session from 'koa-session'
import { getAuthHandlers } from './server-routes/auth.js'
const SERVICE_PORT = process.env.SERVICE_PORT || 4411
const SESSION_KEYS = process.env.SESSION_KEYS.split(",")

async function buildApp() {
  const app = new Koa()
  //session keys
  app.keys = SESSION_KEYS
  const sessionConfig = {
    key: "yaz.sess",
    maxAge: 90 * 24 * 60 * 60 * 1000 //90 day session
  }
  app.use(session(sessionConfig, app))
  const router = new Router()

  const authHandlers = await getAuthHandlers()

  router.get('/login/github', authHandlers.handleGitHubLogin)
  router.get('/login/github/callback', authHandlers.handleGitHubLoginCallback)

  app.use(router.routes()).use(router.allowedMethods())

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
