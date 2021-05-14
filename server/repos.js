import GitHub from 'github-api'
import NodeGit from 'nodegit'
import { stat, mkdir } from 'fs/promises'

export async function buildRepoHandlers() {
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
    const { repoId, clone_url, repoType } = ctx.query
    const userId = ctx.session.yazUserId

    const userDirectoryPath = `./data/repos/${userId}`
    await createFolderIfDoesNotExist(userDirectoryPath)

    const repoDirectoryPath = `${userDirectoryPath}/${repoId}`
    const repoAlreadyExists = await validDirectoryExists(repoDirectoryPath)

    if(repoAlreadyExists) {
      ctx.status = 409
      ctx.body = { msg: 'Already exists'}
      return
    }

    const cloneOptions = {}
    cloneOptions.fetchOpts = {
      callbacks: {
        certificateCheck: function() { return 0; },
        credentials: function() {
          return NodeGit.Cred.userpassPlaintextNew(ctx.session.githubToken, "x-oauth-basic");
        }
      }
    }
    const repo = await NodeGit.Clone.clone(clone_url, repoDirectoryPath, cloneOptions)    

    ctx.body = {
      msg: 'Done!'
    }
  }

  async function createFolderIfDoesNotExist(path) {
    const directoryExists = await validDirectoryExists(path)
    if(!directoryExists) {
      console.log(`Creating directory "${path}"`)
      await mkdir(path)
    }
  }

  async function validDirectoryExists(path) {
    try {
      return (await stat(path)).isDirectory()
    } catch(err) {
      return false
    }
  }

  return {
    handleGetAvailableRepos,
    handleGetConnectedRepos,
    handleCreateRepoConnection
  }
}
