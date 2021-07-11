import send from 'koa-send'
import { createReadStream } from 'fs'

export async function createClientAppHandlers() {
  
  async function handleGetApp(ctx) {
    const assetsPaths = '/app/assets'
    const staticPaths = '/app/static'
    if (ctx.path.startsWith(assetsPaths.toLowerCase())) {
      await send(ctx, ctx.path.slice(assetsPaths.length + 1), {
        root: './build/assets',
      })
    } else if (ctx.path.startsWith(staticPaths.toLowerCase())) {
      await send(ctx, ctx.path.slice(assetsPaths.length + 1), {
        root: './build/static',
      })
    } else {
      ctx.type = 'html'
      ctx.body = createReadStream('./build/index.html')
    }
  }

  return {
    handleGetApp,
  }
}