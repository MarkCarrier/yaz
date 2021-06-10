import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { buildSectionsFromNewPage } from '../utils/line-assembler'
import DocViewerSection from './doc-viewer-section'
import SmallLoader from './small-loader'
import parse from 'html-react-parser'

export default function DocViewer() {
  const [pages, setPages] = useState([])
  const [sections, setSections] = useState([])
  const [error, setError] = useState(null)
  const { userId, repoKey, docKey } = useParams()
  const [reachedEndOfFile, setReachedEndOfFile] = useState(false)

  useEffect(() => {
    async function getPage(url, previousLines = []) {
      const requestOptions = { credentials: 'include' }
      if (!url) url = `/api/doc/${userId}/${repoKey}/${docKey}/page`

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        setError(response.status)
      } else {
        const newPage = await response.json()
        const [leftOverLines, newSections] = buildSectionsFromNewPage(previousLines, newPage)
        setSections((sections) => [...sections, ...newSections])
        setPages((pages) => [...pages, newPage])
        if (newPage.next) getPage(newPage.next, leftOverLines)
        else setReachedEndOfFile(true)
      }
    }

    if (!pages.length && !error) getPage()
  }, [pages, error])

  if (error)
    return (
      <div className="font-sans mt-32 text-center text-xl font-bold">
        {error}
      </div>
    )

  return (
    <div className="px-20 py-3 font-serif">
      {!reachedEndOfFile && (
        <div className="fixed top-0 right-0 p-4">
          <SmallLoader />
        </div>
      )}
      {!pages.length && (
        <div className="font-sans mt-32 text-center text-xl font-bold">
          Opening document
        </div>
      )}
      <div>
        {sections.map((section, idx) => {
          return parse(section)
        })}
      </div>
    </div>
  )
}
