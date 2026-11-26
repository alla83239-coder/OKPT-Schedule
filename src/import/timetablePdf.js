import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const GROUP_PATTERN = /^(?:\d{2,3}-\d(?:к)?|ПО-\d{2}|\d{1,2}-\d(?:к)?|\d{1,2})$/i

function normaliseToken(value) {
  return value.replace(/[\u00a0\s]+/g, '').replace(/[–—]/g, '-').trim()
}

function extractHeaderGroups(items, pageHeight) {
  // Group IDs sit in the first compact row at the top of each page.
  // Exact-token matching is intentional: do not mine digits from lesson cells.
  const topBand = items.filter(item => {
    const y = item.transform?.[5]
    const top = pageHeight - y
    return Number.isFinite(top) && top >= 0 && top <= 30.5
  })
  const groups = [...new Set(topBand
    .filter(item => {
      const token = normaliseToken(item.str || '')
      // Standalone numeric group IDs (11, 12, 16, 21, 22, 26) sit in
      // the right-hand group columns. Small numbers at the left edge are
      // week/day labels and must not be imported as groups.
      return !/^\\d{1,2}$/.test(token) || (item.transform?.[4] ?? 0) > 300
    })
    .map(item => normaliseToken(item.str || ''))
    .filter(token => GROUP_PATTERN.test(token)))]
  return { groups, headerText: topBand.map(item => item.str || '').join(' ') }
}

export async function inspectTimetablePdf(file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Выберите PDF-файл расписания.')
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  if (pdf.numPages < 1) throw new Error('В PDF нет страниц.')

  const groups = new Set()
  const pageSummaries = []
  const headerLines = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const extracted = extractHeaderGroups(content.items, viewport.height)
    extracted.groups.forEach(group => groups.add(group))
    headerLines.push(`Страница ${pageNumber}: ${extracted.headerText}`)
    pageSummaries.push({
      page: pageNumber,
      textItems: content.items.length,
      textLength: content.items.reduce((sum, item) => sum + (item.str || '').length, 0),
      headerGroupCount: extracted.groups.length
    })
  }

  const groupList = [...groups]
  if (!groupList.length) throw new Error('В верхних строках страниц не удалось обнаружить коды групп. Проверьте, что выбран файл «расписание 13 недели.pdf».')
  return {
    filename: file.name,
    pageCount: pdf.numPages,
    groups: groupList,
    headerLine: headerLines.join('\n'),
    pageSummaries,
    status: 'needs_review',
    extractedAt: new Date().toISOString()
  }
}
