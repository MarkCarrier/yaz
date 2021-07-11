import { nanoid } from 'nanoid'
import axios from 'axios'

export async function buildAuthHandlers(accountStore) {
  const githubAuthUrl = 'https://github.com/login/oauth'
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
  const APP_URL = process.env.APP_URL
  const githubLoginRedirectUrl = `${APP_URL}/login/github/callback`
  const scopes = ['repo', 'admin:repo_hook', 'user']

  async function ensureIsAuthenticated(ctx, next) {
    if(!ctx.session.yazUserId) {
      ctx.throw(401, "Please log in")
    } else {
      return next()
    }
  }

  async function handleGitHubLogin(ctx) {
    const state = nanoid()
    ctx.session = {
      state
    }
    const loginUrl = `${githubAuthUrl}/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      githubLoginRedirectUrl
    )}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`

    ctx.redirect(loginUrl)
  }

  async function handleGitHubLoginCallback(ctx) {
    const expectedState = ctx.session.state
    const receivedState = ctx.request.query.state
    const code = ctx.request.query.code

    if (
      !expectedState ||
      !receivedState ||
      !code ||
      expectedState != receivedState
    ) {
      ctx.status = 400
      ctx.body = 'Invalid'
      return
    }

    const tokenData = await getTokenFromGitHub(code, expectedState)
    const githubProfile = await getUserProfileFromGitHub(tokenData.access_token)
    const mappedYazUserId = await accountStore.getItem(
      `github-${githubProfile.id}`,
      'default-map'
    )
    let yazProfile
    if (!mappedYazUserId) {
      yazProfile = await createNewYazProfile(githubProfile)
      console.log(`Created new user profile ${yazProfile.userId}`)
    } else {
      yazProfile = await accountStore.getItem(`yaz-${mappedYazUserId}`, 'basic')
      console.log(`Profile found`)
      yazProfile.githubProfile = getImportantGitHubProfileFields(githubProfile)

      await accountStore.putItem(
        `yaz-${mappedYazUserId}`,
        'basic',
        yazProfile
      )
      console.log(`Profile updated`)
    }

    ctx.session = {
      githubToken: tokenData.access_token,
      yazUserId: yazProfile.userId,
      name: yazProfile.name
    }

    await ctx.redirect('/login/debug')
  }

  async function handleDebug(ctx) {
    let yazProfile
    if (ctx.session?.yazUserId) {
      yazProfile = await accountStore.getItem(
        `yaz-${ctx.session.yazUserId}`,
        'basic'
      )
    }

    ctx.body = JSON.stringify(
      {
        session: ctx.session,
        yazProfile: yazProfile
      },
      null,
      ' '
    )
  }

  async function handeGithubProfileRefresh(ctx) {
    let yazProfile = await accountStore.getItem(
      `yaz-${ctx.session.yazUserId}`,
      'basic'
    )
    let githubProfile = await getUserProfileFromGitHub(ctx.session.token)
    console.log(JSON.stringify(githubProfile, null, ' '))
    yazProfile.githubProfile = getImportantGitHubProfileFields(githubProfile)
    await accountStore.putItem(
      `yaz-${ctx.session.yazUserId}`,
      'basic',
      yazProfile
    )
    ctx.redirect('/login/debug')
  }

  async function getTokenFromGitHub(code, state) {
    const tokenResponse = await axios.post(
      `${githubAuthUrl}/access_token`,
      JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: githubLoginRedirectUrl,
        state
      }),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    const tokenData = tokenResponse.data
    console.log(`Got token data: ${JSON.stringify(tokenData, null, ' ')}`)

    return tokenData
  }

  async function getUserProfileFromGitHub(accessToken) {
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    })

    return userResponse.data
  }

  async function createNewYazProfile(githubProfile) {
    const userId = nanoid().slice(0, 5).toLowerCase()

    let existingAccount = await accountStore.getItem(`yaz-${userId}`,'basic')
    if(existingAccount) {
      throw new Exception('Account id collision!')
    }

    const yazProfile = {
      userId,
      aliases: [nanoid().slice(0, 5).toLowerCase()],
      githubProfile: getImportantGitHubProfileFields(githubProfile),
      name: githubProfile.name,
      email: githubProfile.email
    }
    await accountStore.putItem(`yaz-${yazProfile.userId}`, 'basic', yazProfile)
    await accountStore.putItem(
      `github-${githubProfile.id}`,
      'default-map',
      yazProfile.userId
    )
    await accountStore.putItem(
      `alias-${yazProfile.aliases[0]}`,
      'default-alias',
      yazProfile.userId
    )

    return yazProfile
  }

  function getImportantGitHubProfileFields(githubProfile) {
    return {
      id: githubProfile.id,
      login: githubProfile.login,
      repos: githubProfile.repos_url
    }
  }

  return {
    ensureIsAuthenticated,
    handleGitHubLogin,
    handleGitHubLoginCallback,
    handleDebug,
    handeGithubProfileRefresh
  }
}
