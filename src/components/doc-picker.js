import Modal from 'react-modal'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const customStyles = {
  content: {
    width: '100%',
    top: '77px',
    left: 0,
    bottom: 0,
    marginLeft: 0,
    border: 'none',
    borderRadius: 0,
    backgroundColor: '#2A2A2A',
    color: 'white',
    cursor: 'auto'
  },
  overlay: {
    zIndex: 30,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    cursor: 'pointer'
  }
}

Modal.setAppElement('#root')
export default function DockerPicker({ isOpen, onClose, userId, repoKey }) {
  const [index, setIndex] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function getIndex() {
      const requestOptions = { credentials: 'include' }
      const url = `/api/doc/${userId}/${repoKey}/docs`

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        setError(response.status)
      } else {
        const index = await response.json()

        setIndex(index)
      }
    }

    if (!index && !error) getIndex()
  }, [index, error, repoKey, userId])

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      closeTimeoutMS={350}
      style={customStyles}
      contentLabel="Doc Picker"
    >
      <button className="float-right white-button" onClick={onClose}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <h2 className="font-bold text-3xl mt-3 mb-5 font-sans">Docs</h2>
      {error}
      {index &&
        Object.keys(index.docs).map((docId) => {
          const doc = index.docs[docId]
          return (
            <Link
              key={docId}
              to={`/app/${doc.userKey}/${doc.repoKey}/${doc.docKey}`}
              onClick={onClose}
            >
              <div className="text-xl py-2 px-2 font-mono w-full hover:bg-gray-500 rounded">
                {docId}
              </div>
            </Link>
          )
        })}
    </Modal>
  )
}
