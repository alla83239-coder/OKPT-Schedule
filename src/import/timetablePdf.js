import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const GROUP_PATTERN = /^(?:\d{2,3}-\d(?:к)?|ПО-\d{2}|\d{1,2}-\d(?:к)?|\d{1,2})$/i

function normaliseToken(value) {
  return value.replace(/[\u00a0\s]+/g, '').replace(/[–—]/g, '-').trim()
}

function buildTextRows(items) {
  const rows = []
  const sorted = [...items].filter(item => item.str?.trim()).sort((a, b) =>
    (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0) ||
    (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0)
  )
  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2.5)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push(item)
  }
  return rows.map(row => {
    row.items.sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))
    return { ...row, text: row.items.map(item => item.str).join(' ') }
  })
}

function groupCandidatesFromHeader(items) {
  const rows = buildTextRows(items)
  const header = rows.find(row => /\b13\b/.test(row.text) && /недел/i.test(row.text))
  if (!header) return { groups: [], headerFound: false, headerLine: '' }

  // Read only items to the right of the "13 неделя" marker on the same
  // visual row. This avoids interpreting lesson/room numbers as group IDs.
  const marker = header.items.find(item => /недел/i.test(item.str || '')) ||
    header.items.find(item => /\b13\b/.test(item.str || ''))
  const markerX = marker?.transform?.[4] ?? -Infinity
  const rowItems = header.items.filter(item => (item.transform?.[4] ?? 0) > markerX)
  const raw = rowItems.flatMap(item =>
    (item.str || '').match(/(?:ПО\s*[-–—]?\s*\d{2}|\d{2,3}\s*[-–—]\s*\d\s*к?|\d{1,2}\s*[-–—]\s*\d\s*к?|\b\d{1,2}\b)/gi) || []
  )
  const groups = [...new Set(raw.map(normaliseToken).filter(token => GROUP_PATTERN.test(token)))]
  return { groups, headerFound: true, headerLine: header.text }
}

export async function inspectTimetablePdf(file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Выберите PDF-файл расписания.')
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  if (pdf.numPages < 1) throw new Error('В PDF нет страниц.')

  const firstPage = await pdf.getPage(1)
  const content = await firstPage.getTextContent()
  const header = groupCandidatesFromHeader(content.items)

  if (!header.headerFound) throw new Error('На первой странице не найден заголовок «13 неделя». Проверьте выбранный PDF.')
  if (!header.groups.length) throw new Error('Заголовок недели найден, но коды групп не удалось выделить из его строки. Нужна проверка структуры PDF.')

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
