

export function buildSectionsFromNewPage(previousPages, newPage) {
  return newPage.lines.map(line => { return {
    sectionType: 'plainline',
    sectionContent: line
  } })  
}