import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const GROUP_PATTERN = /^(?:\d{2,3}-\d(?:к)?|ПО-\d{2}|\d{1,2}-\d(?:к)?|\d{1,2})$/i

function normaliseToken(value) {
  return value.replace(/[\u00a0\s]+/g, '').replace(/[–—]/g, '-').trim()
}

function groupCandidatesFromHeader(text) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const headerIndex = lines.findIndex(line => /13\s*недел/i.test(line))
  if (headerIndex < 0) return { groups: [], headerFound: false, headerLine: '' }

  const headerText = [lines[headerIndex], lines[headerIndex + 1] || ''].join(' ')
  const raw = headerText.match(/(?:ПО\s*[-–—]?\s*\d{2}|\d{2,3}\s*[-–—]\s*\d\s*к?|\d{1,2}\s*[-–—]\s*\d\s*к?|\b\d{1,2}\b)/gi) || []
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
  const firstPageText = content.items.map(item => item.str || '').join(' ')
  const header = groupCandidatesFromHeader(firstPageText)

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
