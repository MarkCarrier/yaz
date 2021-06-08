import send from 'koa-send'
import { readFile } from 'fs/promises'
import { createReadStream } from 'fs'
import marked from 'marked'
import fm from 'front-matter'
import stream from 'stream'

function buildLineStream() {
  const lineStream = new stream.Transform({ objectMode: true })
  let totalBytes = 0

  lineStream._transform = function (chunk, encoding, cb) {
    this._totalBytes = this._totalBytes || 0
    this._totalBytes += chunk.length
    var strData = chunk.toString()

    if (this._partialLine) {
      strData = this._partialLine + strData
    }

    var objLines = strData.split('\n')
    this._partialLine = objLines.splice(objLines.length - 1, 1)[0]
    this.push(objLines)
    console.log(`xtream _transform, pushed ${objLines.length} lines`)

    return cb(null, chunk + '\n')
    //cb()
  }

  lineStream._flush = function (cb) {
    if (this._partialLine) {
      this.push([this._partialLine])
    }

    this._partialLine = null
    cb()
  }
  return lineStream
}

async function getPageLines(
  filename,
  startPos = 0,
  maxLines = 100,
  firstLinePrefix,
  pageSize = 2 * 1024
) {
  return new Promise((resolve, reject) => {
    let pageLines = []
    let lastPos
    const readStream = createReadStream(filename, {
      start: startPos,
      highWaterMark: pageSize
    })
    const lineStream = buildLineStream()
    readStream.pipe(lineStream)
    lineStream.on('readable', () => {
      let lines
      while ((lines = lineStream.read()) && pageLines.length < maxLines) {
        //console.log(`lineStream readable fired, got ${lines.length} lines`)
        if (!pageLines.length && firstLinePrefix && lines.length) {
          const completedFirstLine = `${firstLinePrefix}${lines[0]}`
          lines = [completedFirstLine, ...lines.slice(1)]
        }

        pageLines = pageLines.concat(lines)

        if (pageLines.length >= maxLines) {
          readStream.destroy()
        } else {
          lastPos = readStream.pos
        }
      }
    })
    readStream.on('close', () => {
      console.log(`Stream close fired. Read ${lineStream._totalBytes || 0} bytes`)

      const reachedEnd = lineStream._totalBytes < pageSize
      if(reachedEnd) pageLines.push(lineStream._partialLine)

      resolve({
        pageLines,
        endsAt: lineStream._totalBytes + startPos,
        nextLineStart: reachedEnd ? null : lineStream._partialLine
      })
    })

    readStream.on('end', () => {
      console.log(`Stream end fired`)
      if (!pageLines.length && firstLinePrefix) pageLines.push(firstLinePrefix)
      resolve({
        pageLines,
        endsAt: lineStream._totalBytes + startPos,
        nextLineStart: null
      })
    })
  })
}

export async function buildDocHandlers(accountStore) {
  async function handleGetDocPage(ctx) {
    const { userId, repoKey, docKey } = ctx.params
    const { numLines, startAt, nextLineStart } = ctx.query

    if (userId !== ctx.session.yazUserId) ctx.throw(401, 'Nope nope nope')

    const fileIndex = await accountStore.getItem(
      `yaz-${ctx.session.yazUserId}`,
      `repo-index-${repoKey}`
    )

    if (!fileIndex) ctx.throw(400, 'No repo')

    const fileInfo = fileIndex.files[docKey]
    if (!fileInfo) ctx.throw(404, 'No doc')

    const isTextFile = true

    if (!isTextFile) ctx.throw(400, 'Text only')

    let start = 0
    if (startAt && parseInt(startAt) == startAt && startAt > 0) {
      start = parseInt(startAt)
    }

    let pageLines = await getPageLines(
      `./data/repos/${userId}/${repoKey}/${fileInfo.fileName}`,
      start,
      numLines || 20,
      nextLineStart || ''
    )

    const next = pageLines.nextLineStart ? `/api/doc/${userId}/${repoKey}/${docKey}/page?startAt=${
      pageLines.endsAt
    }&nextLineStart=${encodeURIComponent(pageLines.nextLineStart)}` : null

    ctx.body = {
      file: fileInfo,
      lines: pageLines.pageLines,
      next
    }
  }

  async function handleGetDocList(ctx) {
    const { userId, repoKey } = ctx.params

    if (userId !== ctx.session.yazUserId) ctx.throw(401, 'Nope nope nope')

    const fileIndex = await accountStore.getItem(
      `yaz-${ctx.session.yazUserId}`,
      `repo-index-${repoKey}`
    )

    if (!fileIndex) ctx.throw(400, 'No repo')

    ctx.body = {
      docs: Object.keys(fileIndex.files).reduce((acc, next) => {
        acc[fileIndex.files[next].fileName] = {
          userKey: userId,
          repoKey: repoKey,
          docKey: next,
          encoding: fileIndex.files[next].encoding,
          name: fileIndex.files[next].fileName,
          pages: {
            href: `/api/doc/${userId}/${repoKey}/${next}/page`,
            rel: ['first']
          }
        }
        return acc
      }, {})
    }
  }

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
      const content = fm(fileContent)
      console.log(`Doc: ${JSON.stringify(content.attributes, null, ' ')}`)
      const html = marked(content.body)
      ctx.body = html
    } else {
      await send(ctx, `./data/repos/${userId}/${repoKey}/${fileInfo.fileName}`)
    }
  }

  return {
    handleGetDoc,
    handleGetDocList,
    handleGetDocPage
  }
}