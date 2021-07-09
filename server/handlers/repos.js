import GitHub from 'github-api'
import { cloneGitRepo, indexRepoFolder } from '../../utils/git-repos'

export async function buildRepoHandlers(accountStore) {
  
  async function handleGetAvailableRepos(ctx) {
    const github = new GitHub({
      token: ctx.session.githubToken
    })

    const me = github.getUser()
    const myRepos = await me.listRepos()
    console.log(Object.keys(myRepos).join(','))

    ctx.body = {
      githubRepos: myRepos.data.reduce((acc, next) => {
        const repoId =`gh-${next.id}`
        acc[next.full_name] = { 
          clone_url: next.clone_url,
          connect_link: `/api/repo/connection/?repoId=${encodeURIComponent(repoId)}&repoType=github&clone_url=${encodeURIComponent(next.clone_url)}`,
          repoId: repoId
         }
        return acc
      }, {})
    }
  }

  async function handleGetConnectedRepos(ctx) {}

  async function handleCreateRepoConnection(ctx) {
    const { repoKey, repoReference, clone_url, repoType } = ctx.query

    const userRepoList = (await accountStore.getItem(
      `yaz-${ctx.session.yazUserId}`,
      'repo-list'
    )) || []

    if(userRepoList.map(r => r.repoKey).indexOf(repoKey) !== -1) {
      ctx.throw(400, 'Already connected')
    }

    const userId = ctx.session.yazUserId
    
    await cloneGitRepo(userId, repoKey, clone_url, ctx.session.githubToken)
    const repoIndex = await indexRepoFolder(userId, repoKey)    

    await accountStore.putItem(
      `yaz-${ctx.session.yazUserId}`,
      'repo-list',
      userRepoList.concat({ repoKey, repoReference, clone_url, repoType})
    )

    await accountStore.putItem(
      `yaz-${ctx.session.yazUserId}`,
      `repo-index-${repoKey}`,
      repoIndex
    )

    ctx.body = repoIndex
  }

  return {
    handleGetAvailableRepos,
    handleGetConnectedRepos,
    handleCreateRepoConnection
  }
}
