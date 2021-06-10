

export default function DocViewerSection({ section }) {
  return (
    <div
      className="doc-section font-mono"
      style={{ paddingLeft: '1.5em', textIndent: '-1.5em' }}
      dangerouslySetInnerHTML={createMarkup(section)}
    >      
    </div>
  )
}

function createMarkup(section) { return {__html: section}; };
