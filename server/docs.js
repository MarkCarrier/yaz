import send from 'koa-send'
import { readFile } from 'fs/promises'
import marked from 'marked'

export async function buildDocHandlers(accountStore) {
  async function handleGetDoc(ctx) {
    const { userId, repoKey, docKey } = ctx.params

    if (userId !== ctx.session.yazUserId) ctx.throw(401, 'Nope nope nope')

    const fileIndex = await accountStore.getItem(
      `yaz-${ctx.session.yazUserId}`,
      `repo-index-${repoKey}`
    )

    if (!fileIndex) ctx.throw(400, 'No repo')

    const fileInfo = fileIndex.files[docKey]
    if (!fileInfo) ctx.throw(404, 'No doc')

    if (fileInfo.fileName.toLowerCase().endsWith('.md')) {
      const fileContent = await readFile(
        `./data/repos/${userId}/${repoKey}/${fileInfo.fileName}`,
        fileInfo.encoding
      )
      const html = marked(fileContent)
      ctx.body = html
    } else {
      await send(ctx, `./data/repos/${userId}/${repoKey}/${fileInfo.fileName}`)
    }
  }

  return {
    handleGetDoc
  }
}
