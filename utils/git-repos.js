//import 'core-js/stable'
//import 'regenerator-runtime/runtime'
import chardet from 'chardet'
import { stat, mkdir, readdir } from 'fs/promises'
import bs58 from 'bs58'
import crypto from 'crypto'
import { DateTime } from 'luxon'
import NodeGit from 'nodegit'

const getUserDirectory = (userId) => `./data/repos/${userId}`
const getRepoDirectory = (userId, repoKey) =>
  `${getUserDirectory(userId)}/${repoKey}`

export async function cloneGitRepo(userId, repoKey, cloneUrl, githubToken) {
  const userDirectoryPath = getUserDirectory(userId)
  await createFolderIfDoesNotExist(userDirectoryPath)

  const repoDirectoryPath = getRepoDirectory(userId, repoKey)
  const repoAlreadyExists = await validDirectoryExists(repoDirectoryPath)

  if (repoAlreadyExists) {
    throw new Error('Repo already exists')
  }

  const cloneOptions = {}
  cloneOptions.fetchOpts = {
    callbacks: {
      certificateCheck: function () {
        return 0
      },
      credentials: function () {
        return NodeGit.Cred.userpassPlaintextNew(githubToken, 'x-oauth-basic')
      }
    }
  }
  const repo = await NodeGit.Clone.clone(
    cloneUrl,
    repoDirectoryPath,
    cloneOptions
  )

  return repo
}

export async function indexRepoFolder(userId, repoKey) {
  const folderPath = getRepoDirectory(userId, repoKey)
  const repo = await NodeGit.Repository.open(folderPath)
  const commitHash = (await repo.getHeadCommit()).sha()
  const allFiles = await getAllFiles(folderPath, folderPath + '/')

  return {
    userId,
    repoKey,
    indexTime: Math.round(DateTime.now().setZone('utc').toSeconds()),
    commitHash,
    files: allFiles.reduce((acc,next) => {
      acc[next.key] = next
      return acc
    },{})
  }
}

async function getAllFiles(dir, excludePath, exludeHiddenFiles = true) {
  const filesInDir = await readdir(dir)
  const fileInfoTasks = filesInDir.map(async (file) => {
    const filePath = `${dir}/${file}`
    const fileName = filePath.replace(excludePath, '')
    const fileInfo = await stat(filePath)
    const isDirectory = fileInfo.isDirectory()
    let encoding = null
    let children = []
    let key = null
    if (!isDirectory) {
      encoding = await chardet.detectFile(filePath)
      key = await createFilenameKey(fileName)
    } else if (fileName !== '.git') {
      children = await getAllFiles(filePath, excludePath, exludeHiddenFiles)
    }

    return { key, fileName, isDirectory, encoding, children }
  })
  const fileInfos = await Promise.all(fileInfoTasks)

  const files = fileInfos.filter(
    (fi) =>
      !fi.isDirectory && (!exludeHiddenFiles || !fi.fileName.startsWith('.'))
  )
  const folders = fileInfos.filter(
    (fi) =>
      fi.isDirectory && (!exludeHiddenFiles || !fi.fileName.startsWith('.'))
  )

  const allFiles = folders.reduce((acc, next) => {
    return next.children.concat(acc)
  }, files)

  return allFiles.map(({ key, fileName, isDirectory, encoding }) => ({
    key,
    fileName,
    encoding
  }))
}

async function createFilenameKey(filename) {
  const hexString = await crypto
    .createHash('sha256')
    .update(filename)
    .digest('hex')
  const bytes = Buffer.from(hexString, 'hex')
  const key = bs58.encode(bytes)
  return key.slice(0, 9)
}

async function createFolderIfDoesNotExist(path) {
  const directoryExists = await validDirectoryExists(path)
  if (!directoryExists) {
    console.log(`Creating directory "${path}"`)
    await mkdir(path)
  }
}

async function validDirectoryExists(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch (err) {
    return false
  }
}

if (false) {
  indexRepoFolder('PuGsbBfbIYEJHq1vWhkLJ', 'gh-243866275').then((idx) => {
    console.log(JSON.stringify(idx, null, '  '))
  })
}
