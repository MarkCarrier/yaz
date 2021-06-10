export default function DocViewerSection({ section }) {
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
