import Router from '@koa/router'
import { buildAuthHandlers } from './handlers/auth'
import { buildRepoHandlers } from './handlers/repos'
import { buildDocHandlers } from './handlers/docs'
import { createClientAppHandlers } from './handlers/client-app'

export async function buildAppRouter(accountStore) {
  const router = new Router()

  const authHandlers = await buildAuthHandlers(accountStore)
  router.get('/login/github/refresh', authHandlers.handeGithubProfileRefresh)
  router.get('/login/github/callback', authHandlers.handleGitHubLoginCallback)
  router.get('/login/github', authHandlers.handleGitHubLogin)
  router.get('/login/debug', authHandlers.handleDebug)

  const repoHandlers = await buildRepoHandlers(accountStore)
  router.get(
    '/api/repo/available/',
    authHandlers.ensureIsAuthenticated,
    repoHandlers.handleGetAvailableRepos
  )
  router.get(
    '/api/repo/connection/',
    authHandlers.ensureIsAuthenticated,
    repoHandlers.handleCreateRepoConnection
  )

  const docHandlers = await buildDocHandlers(accountStore)
  router.get(
    '/d/:userId/:repoKey/:docKey',
    authHandlers.ensureIsAuthenticated,
    docHandlers.handleGetDoc
  )
  router.get(
    '/api/doc/:userId/:repoKey/docs',
    authHandlers.ensureIsAuthenticated,
    docHandlers.handleGetDocList
  )
  router.get(
    '/api/doc/:userId/:repoKey/:docKey/page',
    authHandlers.ensureIsAuthenticated,
    docHandlers.handleGetDocPage
  )

  const clientAppHandlers = await createClientAppHandlers()
  router.get(
    '/app/static/(.*)',
    authHandlers.ensureIsAuthenticated,
    clientAppHandlers.handleGetApp
  )

  router.get(
    '/app/assets/(.*)',
    authHandlers.ensureIsAuthenticated,
    clientAppHandlers.handleGetApp
  )
  router.get(
    '/app(.*)',
    authHandlers.ensureIsAuthenticated,
    clientAppHandlers.handleGetApp
  )

  return router
}
