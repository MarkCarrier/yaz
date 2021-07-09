import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { buildSectionsFromNewPage } from '../utils/line-assembler'
import DocViewerSection from './doc-viewer-section'
import SmallLoader from './small-loader'
import DocPicker from './doc-picker'

export default function DocViewer() {
  const [pages, setPages] = useState([])
  const [sections, setSections] = useState([])
  const [error, setError] = useState(null)
  const [pageStatus, setPageStatus] = useState(null)

  const { userId, repoKey, docKey } = useParams()

  const [docPickerOpen, setDockPickerOpen] = useState(false)

  useEffect(() => {
    async function getPage(url, lineOffset = 0, previousLines = []) {
      const requestOptions = { credentials: 'include' }
      if (!url) url = `/api/doc/${userId}/${repoKey}/${docKey}/page`

      setPageStatus((pageStatus) => ({
        status: 'fetching',
        url,
        userId,
        repoKey,
        docKey,
        lineOffset
      }))

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
        let updatedSections = newSections
        if(lineOffset > 0) {
          updatedSections = [...sections, ...newSections]
        }
        setSections((sections) => updatedSections)
        setPages((pages) => [...pages, newPage])

        if (lineOffset === 0) {
          document.title = newPage.frontmatter?.title || newPage.file.fileName
        }

        if (newPage.next) {
          getPage(
            newPage.next,
            lineOffset + newPage.lines.length,
            leftOverLines
          )
        } else {
          const [_, tailsSections] = buildSectionsFromNewPage(
            leftOverLines,
            null,
            updatedSections[updatedSections.length - 1].endLine + 1
          )
          setSections((sections) => [...updatedSections,...tailsSections])

          setPageStatus((pageStatus) => ({
            status: 'loaded',
            url,
            userId,
            repoKey,
            docKey,
            lineOffset
          }))
        }
      }
    }

    if (!error) {
      if (pageStatus == null) {
        getPage()
      } else if (
        pageStatus.userId !== userId ||
        pageStatus.repoKey !== repoKey ||
        pageStatus.docKey !== docKey
      ) {
        setPages(pages => [])
        setSections((sections) => [])
        getPage()
      }
    }
  }, [pages, pageStatus, error, docKey, repoKey, userId])

  if (error)
    return (
      <div className="font-sans mt-32 text-center text-xl font-bold ">
        {error}
      </div>
    )

  return (
    <div className="mx-auto pb-32 font-serif max-w-5xl px-4">
      <DocPicker
        isOpen={docPickerOpen}
        repoKey={repoKey}
        userId={userId}
        onClose={() => setDockPickerOpen(false)}
      />
      {(!pageStatus || pageStatus.status === 'fetching') && (
        <div className="fixed top-0 right-0 p-4 z-20">
          <SmallLoader />
        </div>
      )}
      <div>
        <div
          className="w-full h-20 fixed pb-2 pt-4 z-10 border-b-2 left-0 px-2 cursor-pointer hover:bg-gray-200 bg-white"
          onClick={() => setDockPickerOpen(!docPickerOpen)}
        >
          <div className="max-w-5xl mx-auto">
            {pages.length > 0 && pages[0].frontmatter?.title && (
              <>
                <div className="text-xl font-extrabold">
                  {pages[0].frontmatter.title}
                </div>
                <div className="text-lg text-gray-400 font-mono">
                  {pages[0].file.fileName}
                </div>
              </>
            )}
            {pages.length > 0 && !pages[0].frontmatter?.title && (
              <div className="text-xl font-extrabold">
                {pages[0].file.fileName}
              </div>
            )}
            {!pages.length > 0 && (
              <div className="text-2xl mt-2 font-extrabold">Fetching Doc</div>
            )}
          </div>
        </div>

        <div className="absolute top-24 mt-3 mr-12 pb-32">
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
