import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const GROUP_PATTERN = /^(?:\d{2,3}-\d(?:к)?|ПО-\d{2}|\d{1,2}-(?:\dк?|к)|\d{1,2}к?)$/i

function normaliseToken(value) {
  return value.replace(/[\u00a0\s]+/g, '').replace(/[–—]/g, '-').trim()
}

function extractHeaderGroups(items, pageHeight) {
  const topBand = items.filter(item => {
    const y = item.transform?.[5]
    const top = pageHeight - y
    return Number.isFinite(top) && top >= 0 && top <= 34
  })

  const headerItems = topBand.filter(item => {
    const token = normaliseToken(item.str || '')
    const top = pageHeight - (item.transform?.[5] ?? pageHeight)
    // Standalone numeric IDs are only valid in the right-hand group columns.
    return !/^\d{1,2}$/.test(token) || ((item.transform?.[4] ?? 0) > 300 && top <= 32.5)
  })

  const headers = headerItems
    .map(item => ({ group: normaliseToken(item.str || ''), x: item.transform?.[4] ?? 0 }))
    .filter(item => GROUP_PATTERN.test(item.group))
    .sort((a, b) => a.x - b.x)

  return {
    headers,
    groups: [...new Set(headers.map(item => item.group))],
    headerText: topBand.map(item => item.str || '').join(' ')
  }
}

function groupColumnItems(items, headers, pageHeight) {
  const columns = headers.map((header, index) => {
    const left = index === 0 ? -Infinity : (headers[index - 1].x + header.x) / 2
    const right = index === headers.length - 1 ? Infinity : (header.x + headers[index + 1].x) / 2
    const columnItems = items.filter(item => {
      const x = item.transform?.[4]
      const top = pageHeight - (item.transform?.[5] ?? pageHeight)
      return Number.isFinite(x) && x >= left && x < right && top > 34
    }).sort((a, b) => {
      const ay = pageHeight - (a.transform?.[5] ?? pageHeight)
      const by = pageHeight - (b.transform?.[5] ?? pageHeight)
      return ay - by || (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0)
    })

    // Reconstruct visual text lines by baseline, then preserve larger vertical
    // gaps as separate raw cell blocks. This is deliberately not semantic parsing.
    const lines = []
    for (const item of columnItems) {
      const y = pageHeight - (item.transform?.[5] ?? pageHeight)
      let line = lines.find(candidate => Math.abs(candidate.y - y) <= 1.8)
      if (!line) {
        line = { y, parts: [] }
        lines.push(line)
      }
      line.parts.push({ x: item.transform?.[4] ?? 0, text: item.str || '' })
    }
    lines.sort((a, b) => a.y - b.y)
    for (const line of lines) {
      line.parts.sort((a, b) => a.x - b.x)
      line.text = line.parts.map(part => part.text).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    }

    const blocks = []
    for (const line of lines) {
      if (!line.text) continue
      const previous = blocks[blocks.length - 1]
      if (!previous || line.y - previous.lastY > 4.8) {
        blocks.push({ pageYStart: line.y, pageYEnd: line.y, lastY: line.y, lines: [line.text] })
      } else {
        previous.pageYEnd = line.y
        previous.lastY = line.y
        previous.lines.push(line.text)
      }
    }

    return blocks.map((block, index) => ({
      page: null,
      group: header.group,
      block: index + 1,
      yStart: Number(block.pageYStart.toFixed(1)),
      yEnd: Number(block.pageYEnd.toFixed(1)),
      rawText: block.lines.join(' | ')
    }))
  })

  return columns.flat()
}

export async function inspectTimetablePdf(file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Выберите PDF-файл расписания.')
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  if (pdf.numPages < 1) throw new Error('В PDF нет страниц.')

  const groups = new Set()
  const pageSummaries = []
  const headerLines = []
  const rawCellBlocks = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const extracted = extractHeaderGroups(content.items, viewport.height)
    extracted.groups.forEach(group => groups.add(group))
    headerLines.push(`Страница ${pageNumber}: ${extracted.headerText}`)

    const blocks = groupColumnItems(content.items, extracted.headers, viewport.height)
    blocks.forEach(block => rawCellBlocks.push({ ...block, page: pageNumber }))
    pageSummaries.push({
      page: pageNumber,
      textItems: content.items.length,
      textLength: content.items.reduce((sum, item) => sum + (item.str || '').length, 0),
      headerGroupCount: extracted.groups.length,
      rawCellBlockCount: blocks.length
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
    rawCellBlockCount: rawCellBlocks.length,
    rawCellSamples: rawCellBlocks.filter(block => block.rawText.length > 0).slice(0, 36),
    status: 'needs_review',
    extractedAt: new Date().toISOString()
  }
}