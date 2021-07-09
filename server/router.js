import Router from 'koa-router'
import { buildAuthHandlers } from './handlers/auth'
import { buildRepoHandlers } from './handlers/repos'
import { buildDocHandlers } from './handlers/docs'

export async function buildAppRouter(accountStore) {
  const router = new Router()

  const authHandlers = await buildAuthHandlers(accountStore)

  router.get('/login/github/refresh', authHandlers.handeGithubProfileRefresh)
  router.get('/login/github/callback', authHandlers.handleGitHubLoginCallback)
  router.get('/login/github', authHandlers.handleGitHubLogin)
  router.get('/login/debug', authHandlers.handleDebug)

  const repoHandlers = await buildRepoHandlers(accountStore)
  router.get('/api/repo/available/', repoHandlers.handleGetAvailableRepos)
  router.get('/api/repo/connection/', repoHandlers.handleCreateRepoConnection)

  const docHandlers = await buildDocHandlers(accountStore)
  router.get('/d/:userId/:repoKey/:docKey', docHandlers.handleGetDoc)
  router.get('/api/doc/:userId/:repoKey/docs', docHandlers.handleGetDocList)
  router.get('/api/doc/:userId/:repoKey/:docKey/page', docHandlers.handleGetDocPage)  

  return router
}