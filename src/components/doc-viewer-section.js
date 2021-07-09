export default function DocViewerSection({ section }) {
  console.log(`Rendering section ${section.startLine}-${section.endLine} (${section.renderedLines.length} chars).  Front matter = ${section.isFrontMatter}`)
  return (
    <section
      className={`section-${section.startLine}-${section.endLine} ${
        section.isFrontMatter ? 'hidden' : ''
      }`}
      dangerouslySetInnerHTML={createMarkup(section.renderedLines)}
    ></section>
  )
}

function createMarkup(rendered) {
  return { __html: rendered }
}
