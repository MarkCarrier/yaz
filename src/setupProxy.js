const { createProxyMiddleware } = require('http-proxy-middleware')

// This is for development only.
// Allows us to use the development server for some routes and koa web server
// for others on a single port.

const filter = (pathname, req) => {
  const requestShouldGoToBackend =
    !pathname.startsWith(`/app/`) &&
    !pathname.startsWith(`/static/js/`) &&
    pathname.indexOf(`.hot-update.js`) === -1

  if (requestShouldGoToBackend)
    console.log(`Dev PROXY Handling Backend Request: ${pathname}`)
  else console.log(`Dev PROXY Handling Frontend Request: ${pathname}`)
  return requestShouldGoToBackend
}

module.exports = function (app) {
  app.use(
    createProxyMiddleware(filter, {
      target: 'http://localhost:4411',
      changeOrigin: true,
    })
  )
}
