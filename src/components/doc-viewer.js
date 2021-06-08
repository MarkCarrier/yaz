import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { buildSectionsFromNewPage } from '../utils/line-assembler'
import DocViewerSection from './doc-viewer-section'
import { of } from 'core-js/core/array'
export default function DocViewer() {
  const [pages, setPages] = useState([])
  const [sections, setSections] = useState([])
  const [error, setError] = useState(null)
  const { userId, repoKey, docKey } = useParams()

  useEffect(() => {
    async function getPage(url) {
      const requestOptions = { credentials: 'include' }
      if(!url) url = `/api/doc/${userId}/${repoKey}/${docKey}/page` 
      
        const response = await fetch(
        url,
        requestOptions
      )

      if (!response.ok) {
        setError(response.status)
      } else {
        const newPage = await response.json()
        const newSections = buildSectionsFromNewPage(pages, newPage)
        //console.log(newSections)
        setSections([newSections])
        //console.log(JSON.stringify(newPage,null, ' '))
        setPages([newPage])
        if(newPage.next) getPage(newPage.next)
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
  if (!pages.length)
    return (
      <div className="font-sans mt-32 text-center text-xl font-bold">
        Loading
      </div>
    )

  return (
    <div className="p-2">
      {sections.map((section, idx) => {
        return <DocViewerSection key={idx} section={section} />
      })}
    </div>
  )
}
