import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const GROUP_PATTERN = /^(?:\d{2,3}-\d(?:к)?|ПО-\d{2}|\d{1,2}-\d(?:к)?|\d{1,2})$/i

function normaliseToken(value) {
  return value.replace(/[\u00a0\s]+/g, '').replace(/[–—]/g, '-').trim()
}

function groupCandidatesFromHeader(items) {
  const marker = items.find(item => /13\s*недел/i.test(item.str || ''))
  if (!marker) return { groups: [], headerFound: false, headerLine: '' }

  // Restrict extraction to the same PDF coordinate row as "13 неделя".
  // This prevents lesson numbers, room numbers and dates from becoming groups.
  const markerY = marker.transform?.[5] ?? 0
  const markerX = marker.transform?.[4] ?? 0
  const row = items.filter(item => {
    const y = item.transform?.[5] ?? Number.NaN
    const x = item.transform?.[4] ?? Number.NaN
    return Number.isFinite(y) && Number.isFinite(x) && Math.abs(y - markerY) <= 3 && x > markerX
  }).sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))

  const headerText = row.map(item => item.str || '').join(' ')
  const raw = row.flatMap(item => (item.str || '').match(/(?:ПО\s*[-–—]?\s*\d{2}|\d{2,3}\s*[-–—]\s*\d\s*к?|\d{1,2}\s*[-–—]\s*\d\s*к?|\b\d{1,2}\b)/gi) || [])
  const groups = [...new Set(raw.map(normaliseToken).filter(token => GROUP_PATTERN.test(token)))]
  return { groups, headerFound: true, headerLine: headerText }
}

export async function inspectTimetablePdf(file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Выберите PDF-файл расписания.')
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  if (pdf.numPages < 1) throw new Error('В PDF нет страниц.')

  const firstPage = await pdf.getPage(1)
  const content = await firstPage.getTextContent()
  const header = groupCandidatesFromHeader(content.items)

  if (!header.headerFound) throw new Error('На первой странице не найден маркер «13 неделя». Проверьте, что выбран именно файл «расписание 13 недели.pdf».')
  if (!header.groups.length) throw new Error('Маркер недели найден, но группы из заголовка не удалось выделить. Нужна проверка структуры PDF.')

  const pageSummaries = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const pageText = await page.getTextContent()
    pageSummaries.push({
      page: pageNumber,
      textItems: pageText.items.length,
      textLength: pageText.items.reduce((sum, item) => sum + (item.str || '').length, 0)
    })
  }

  return {
    filename: file.name,
    pageCount: pdf.numPages,
    groups: header.groups,
    headerLine: header.headerLine,
    pageSummaries,
    status: 'needs_review',
    extractedAt: new Date().toISOString()
  }
}
