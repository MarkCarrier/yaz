import { getRandomIdString } from '../utils/random-id.js'
import axios from 'axios'
export async function getAuthHandlers() {
  const githubAuthUrl = 'https://github.com/login/oauth'
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
  const githubLoginRedirectUrl = 'http://localhost:4411/login/github/callback'
  const scopes = ['repo', 'admin:repo_hook', 'user']

  async function handleGitHubLogin(ctx) {
    const state = getRandomIdString()
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
    const gitHubProfile = await getUserProfileFromGitHub(tokenData.access_token)

    ctx.session = {
      token: tokenData.access_token,
      profile: gitHubProfile
    }

    ctx.body = JSON.stringify(ctx.session,null, ' ')
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
    const userResponse = await axios.get('https://api.github.com/user',{
      headers: {
        Authorization: `token ${accessToken}`
      }
    })

    return userResponse.data
  }

  return {
    handleGitHubLogin,
    handleGitHubLoginCallback
  }
}
