import { Remarkable } from 'remarkable';

const md = new Remarkable();
const sectionStartEx = /^#+ .*/

export function buildSectionsFromNewPage(leftoverLines, newPage, lineOffset) {

  const mightHaveFrontMatter = lineOffset === 0 && newPage.lines.length > 1 && newPage.lines[0].trim() === '---'
  let endOfFrontMatter = null
  const sections = newPage.lines.reduce((acc, next, idx) => {
    const lineIsNewSectionStart = sectionStartEx.test(next)    
    if(lineIsNewSectionStart || (endOfFrontMatter && endOfFrontMatter === idx-1)) {
      //console.log(`New line start at "${next}"`)
      acc.push([next])
    } else {
      acc[acc.length -1].push(next)
    }
    if(mightHaveFrontMatter && idx > 0 && next.trim() === '---') {
      endOfFrontMatter = idx
    }
    return acc
  },[leftoverLines])

  const completeSectionLines = sections.length > 1 ? sections.slice(0, sections.length - 1) : sections
  const incompleteSectionLines = sections.length > 1 ? sections[sections.length - 1] : []
  
  let currentLineOffset = lineOffset
  const completeSections = completeSectionLines.reduce((acc,next) => {
    const section = {
      startLine: currentLineOffset,
      endLine: currentLineOffset + next.length - 1,
      lines: next,
      renderedLines: md.render(next.join('\n')),
      isFrontMatter: currentLineOffset === 0 && endOfFrontMatter
    }        
    currentLineOffset = currentLineOffset + next.length
    acc.push(section)
    return acc
  },[])  

  return [incompleteSectionLines, completeSections]

}
