import { Remarkable } from 'remarkable';

const md = new Remarkable();
const sectionStartEx = /^#+ .*/

export function buildSectionsFromNewPage(leftoverLines, newPage) {

  const sections = newPage.lines.reduce((acc, next) => {
    const lineIsNewSectionStart = sectionStartEx.test(next)
    if(lineIsNewSectionStart) {
      //console.log(`New line start at "${next}"`)
      acc.push([next])
    } else {
      acc[acc.length -1].push(next)
    }
    return acc
  },[leftoverLines])

  const completeSections = sections.length > 1 ? sections.slice(0, sections.length - 1) : sections
  const incompleteSectionLines = sections.length > 1 ? sections[sections.length - 1] : []

  const renderedSections = completeSections.map(lines => md.render(lines.join('\n')))
  //const renderedSectionComponents = renderedSections.map(html => <div dangerouslySetInnerHTML={() => html} />)

  return [incompleteSectionLines, renderedSections]

  // return newPage.lines.map((line) => {
  //   return {
  //     sectionType: 'plainline',
  //     sectionContent: line
  //   }
  // })
}
