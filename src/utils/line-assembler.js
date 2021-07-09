import { Remarkable } from 'remarkable'

const md = new Remarkable({
  html: true,
  xhtmlOut: true
})
const sectionStartEx = /^#+ .*/

export function buildSectionsFromNewPage(leftoverLines, newPage, lineOffset) {
  if(!newPage) {
    const tailSection = {
      startLine: lineOffset,
      endLine: lineOffset + leftoverLines.length - 1,
      lines: leftoverLines,
      renderedLines: md.render(leftoverLines.join('\n')),
      isFrontMatter: false
    }
    return [[], [tailSection]]
  }

  console.log(`Building sections from ${newPage.length} line page and ${leftoverLines.length} left over lines`)

  const mightHaveFrontMatter =
    lineOffset === 0 &&
    newPage.lines.length > 1 &&
    newPage.lines[0].trim() === '---'
  let endOfFrontMatter = null

  const sectionLineGroups = newPage.lines.reduce(
    (acc, next, idx) => {
      const lineIsNewSectionStart = sectionStartEx.test(next)
      if (
        lineIsNewSectionStart ||
        (endOfFrontMatter && endOfFrontMatter === idx - 1)
      ) {
        //console.log(`New line start at "${next}"`)
        acc.push([next])
      } else {
        acc[acc.length - 1].push(next)
      }
      if (mightHaveFrontMatter && idx > 0 && next.trim() === '---') {
        endOfFrontMatter = idx
      }
      return acc
    },
    [leftoverLines]
  )

  const completeSectionLines =
    sectionLineGroups.length > 1
      ? sectionLineGroups.slice(0, sectionLineGroups.length - 1)
      : sectionLineGroups
  const incompleteSectionLines =
    sectionLineGroups.length > 1
      ? sectionLineGroups[sectionLineGroups.length - 1]
      : []

  let currentLineOffset = lineOffset
  let completeSections = completeSectionLines.reduce((acc, next) => {
    const section = {
      startLine: currentLineOffset,
      endLine: currentLineOffset + (next.length || 1) - 1,
      lines: next,
      renderedLines: md.render(next.join('\n')),
      isFrontMatter: currentLineOffset === 0 && endOfFrontMatter
    }
    currentLineOffset = currentLineOffset + next.length
    acc.push(section)
    return acc
  }, [])

  if(completeSections.length === 1 && completeSections[0].lines.length === 0) {
    completeSections[0].renderedLines = "Nothing Here"
  }
  return [incompleteSectionLines, completeSections]
}
