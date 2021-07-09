import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { buildSectionsFromNewPage } from '../utils/line-assembler'
import DocViewerSection from './doc-viewer-section'
import SmallLoader from './small-loader'

export default function DocViewer() {
  const [pages, setPages] = useState([])
  const [sections, setSections] = useState([])
  const [error, setError] = useState(null)
  const { userId, repoKey, docKey } = useParams()
  const [reachedEndOfFile, setReachedEndOfFile] = useState(false)

  useEffect(() => {
    async function getPage(url, lineOffset = 0, previousLines = []) {
      const requestOptions = { credentials: 'include' }
      if (!url) url = `/api/doc/${userId}/${repoKey}/${docKey}/page`

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        setError(response.status)
      } else {
        const newPage = await response.json()
        const [leftOverLines, newSections] = buildSectionsFromNewPage(
          previousLines,
          newPage,
          lineOffset
        )
        setSections((sections) => [...sections, ...newSections])
        setPages((pages) => [...pages, newPage])
        if(lineOffset === 0) {
          document.title = newPage.frontmatter?.title || newPage.file.fileName
        }
        if (newPage.next)
          getPage(
            newPage.next,
            lineOffset + newPage.lines.length,
            leftOverLines
          )
        else { 
          console.log('Got entire doc')
          setReachedEndOfFile(true)}
      }
    }

    if (!pages.length && !error) getPage()
  }, [pages, error, docKey, repoKey, userId])

  if (error)
    return (
      <div className="font-sans mt-32 text-center text-xl font-bold ">
        {error}
      </div>
    )

  return (
    <div className="px-20 pb-32 font-serif max-w-5xl mx-auto">
      {!reachedEndOfFile && (
        <div className="fixed top-0 right-0 p-4 z-20">
          <SmallLoader />
        </div>
      )}
      {!pages.length > 0 && (
        <div className="font-sans mt-32 text-center text-xl font-bold">
          Opening document
        </div>
      )}
      <div>
        <div className="pb-6 pt-4 fixed bg-white w-full z-10">
          {pages.length > 0 && pages[0].frontmatter?.title && (
            <>
              <div className="text-4xl font-extrabold">
                {pages[0].frontmatter.title}
              </div>
              <div className="text-xl text-gray-400 font-mono mt-1">
                {pages[0].file.fileName}
              </div>
            </>
          )}
          {pages.length > 0 && !pages[0].frontmatter?.title && (
            <div className="text-4xl font-extrabold">
                {pages[0].file.fileName}
              </div>
          )}
        </div>

        <div className="absolute top-24 mr-12 pb-32">
          {sections.map((section, idx) => {
            return (
              <DocViewerSection
                section={section}
                key={`${section.startLine}-${section.endLine}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
