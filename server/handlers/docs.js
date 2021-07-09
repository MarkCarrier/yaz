import send from 'koa-send'
import { readFile } from 'fs/promises'
import { createReadStream } from 'fs'
import marked from 'marked'
import fm from 'front-matter'
import stream from 'stream'
import { performance } from 'perf_hooks'
import yaml from 'js-yaml'
import { updateRepoFolder, indexRepoFolder } from '../../utils/git-repos'

function buildLineStream() {
  const lineStream = new stream.Transform({ objectMode: true })

  lineStream._transform = function (chunk, encoding, cb) {
    this._totalBytes = this._totalBytes || 0
    this._totalBytes += chunk.length
    var strData = chunk.toString()

    if (this._partialLine && this._partialLine.length) {
      //console.log(`Prepending partial line "${this._partialLine}"`)
      strData = this._partialLine + strData
    }

    var objLines = strData.split('\n')
    this._partialLine = objLines.splice(objLines.length - 1, 1)[0]
    console.log(`New partial line = "${this._partialLine}"`)
    
    this.push({ lines: objLines} )
    //console.log(`Read ${objLines.length} lines`)

    return cb(null, chunk + '\n')
    //cb()
  }

  lineStream._flush = function (cb) {
    if (this._partialLine) {
      this.push({ lines: [this._partialLine] })
    }

    this._partialLine = null
    cb()
  }
  return lineStream
}

async function getPageLines(
  filename,
  startPos = 0,
  firstLinePrefix,
  maxLines = 450,
  pageSize = 10 * 1024
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
        if (!pageLines.length && firstLinePrefix && lines.length) {
          const completedFirstLine = `${firstLinePrefix}${lines[0]}`
          lines = [completedFirstLine, ...lines.slice(1)]
        }

        if(lines.lines)
        pageLines = pageLines.concat(lines.lines)

        if (pageLines.length >= maxLines) {
          readStream.destroy()
        } else {
          lastPos = readStream.pos
        }
      }
    })
    readStream.on('close', () => {
      //console.log(`Stream close fired. Read ${lineStream._totalBytes || 0} bytes`)

      const reachedEnd = lineStream._totalBytes < pageSize
      if (reachedEnd) pageLines.push(lineStream._partialLine)

      resolve({
        pageLines,
        endsAt: lineStream._totalBytes + startPos,
        nextLineStart: reachedEnd ? null : lineStream._partialLine
      })
    })

    readStream.on('end', () => {
      //console.log(`Stream end fired`)
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
    const startTS = performance.now()
    const { userId, repoKey, docKey } = ctx.params
    const { numLines, startAt, nextLineStart } = ctx.query

    if (userId !== ctx.session.yazUserId) ctx.throw(401, 'Nope nope nope')

    let fileIndex
    if (!startAt && ctx.session.githubToken) {
      console.log(`Updating repo`)
      const diffs = await updateRepoFolder(
        userId,
        repoKey,
        ctx.session.githubToken
      )
      if (diffs) {
        console.log(`Updating index`)
        fileIndex = await indexRepoFolder(userId, repoKey)
        accountStore.putItem(
          `yaz-${ctx.session.yazUserId}`,
          `repo-index-${repoKey}`,
          fileIndex
        )
      }
    }
    const updateTS = performance.now()
    console.log(`TIMER: Update, ${Math.ceil(updateTS - startTS)}ms`)

    if (!fileIndex) {
      fileIndex = await accountStore.getItem(
        `yaz-${ctx.session.yazUserId}`,
        `repo-index-${repoKey}`
      )
    }
    const indexTS = performance.now()
    console.log(`TIMER: Index, ${Math.ceil(indexTS - updateTS)}ms`)

    if (!fileIndex) ctx.throw(400, 'No repo')

    const fileInfo = fileIndex.files[docKey]
    if (!fileInfo) ctx.throw(404, 'No doc')

    const isTextFile = true

    if (!isTextFile) ctx.throw(400, 'Text only')

    let start = 0
    if (startAt && parseInt(startAt) == startAt && startAt > 0) {
      start = parseInt(startAt)
    }

    const readyTimer = performance.now()
    let pageLines = await getPageLines(
      `./data/repos/${userId}/${repoKey}/${fileInfo.fileName}`,
      start,
      nextLineStart || ''
    )
    const pageTimer = performance.now()
    console.log(
      `TIMER: Page, Read ${pageLines.pageLines.length} lines in ${Math.ceil(
        pageTimer - readyTimer
      )}ms`
    )

    let frontmatter = null
    if (
      start === 0 &&
      pageLines.pageLines.length &&
      pageLines.pageLines[0].trim() === '---'
    ) {
      frontmatter = extractFrontMatter(pageLines.pageLines)
    } else {
      console.log(`No front matter`)
    }
    const fmTS = performance.now()
    console.log(`TIMER: frontmatter: ${Math.ceil(fmTS - pageTimer)}ms`)

    const next = pageLines.nextLineStart
      ? `/api/doc/${userId}/${repoKey}/${docKey}/page?startAt=${
          pageLines.endsAt
        }&nextLineStart=${encodeURIComponent(pageLines.nextLineStart)}`
      : null

    ctx.body = {
      file: fileInfo,
      frontmatter,
      lines: pageLines.pageLines,
      next
    }
    const endTimer = performance.now()
    console.log(`TIMER: After Frontmatter: ${Math.ceil(endTimer - fmTS)}ms`)
    console.log(`TIMER: Handler, ${Math.ceil(endTimer - startTS)}ms`)
  }

  function extractFrontMatter(lines) {
    const startStopLines = lines
      .map((line, idx) => ({ n: idx, line }))
      .filter((l) => l.line.trim() === '---')
    if (startStopLines.length < 2) {
      console.error(`Front matter end not found`)
      return null
    }

    console.log(
      `Discovered front matter from ${startStopLines[0].n} to ${startStopLines[1].n}`
    )

    const frontMatter = lines.slice(0, startStopLines[1].n).join('\n')
    const frontMatterData = yaml.load(frontMatter)
    return frontMatterData
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
