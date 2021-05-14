import Router from 'koa-router'
import { buildAuthHandlers } from './auth'
import { buildRepoHandlers } from './repos'

export async function buildAppRouter(accountStore) {
  const router = new Router()

  const authHandlers = await buildAuthHandlers(accountStore)

  router.get('/login/github/refresh', authHandlers.handeGithubProfileRefresh)
  router.get('/login/github/callback', authHandlers.handleGitHubLoginCallback)
  router.get('/login/github', authHandlers.handleGitHubLogin)
  router.get('/login/debug', authHandlers.handleDebug)

  const repoHandlers = await buildRepoHandlers()
  router.get('/api/repo/available/', repoHandlers.handleGetAvailableRepos)
  router.get('/api/repo/connection/', repoHandlers.handleCreateRepoConnection)

  return router
}