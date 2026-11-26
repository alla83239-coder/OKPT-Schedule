import './style.css'
import { inspectTimetablePdf } from './import/timetablePdf.js'

const app = document.querySelector('#app')
const sections = [
  ['overview', 'Обзор'],
  ['groups', 'Группы'],
  ['teachers', 'Преподаватели'],
  ['rooms', 'Аудитории'],
  ['curricula', 'Учебные планы'],
  ['calendar', 'Календарь'],
  ['replacements', 'Замены'],
  ['checks', 'Проверка']
]

const state = { importResult: null, approvedGroups: [], activeSection: 'overview' }

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">О</div><div><strong>ОКПТ</strong><span>Управление расписанием</span></div></div>
      <div class="side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav class="nav" aria-label="Основная навигация">
        ${sections.map(([id, label], i) => `<button class="nav-item ${i === 0 ? 'active' : ''}" data-section="${id}"><span class="nav-dot"></span>${label}</button>`).join('')}
      </nav>
      <div class="sidebar-bottom"><span class="status-dot"></span><div><strong>Локальный прототип</strong><small>Черновики хранятся только в текущем сеансе</small></div></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="crumb">ОКПТ <span>/</span> <b id="section-title">Обзор</b></div><div class="top-actions"><span class="year-chip">2026 / 2027</span><button class="avatar" aria-label="Профиль">А</button></div></header>
      <section class="content">
        <div class="welcome-row"><div><p class="eyebrow">ДИСПЕТЧЕРСКАЯ · УЧЕБНЫЙ ГОД 2026/2027</p><h1 id="page-heading">Обзор расписания</h1><p class="subheading">Единое пространство для планирования, контроля нагрузки и управления заменами.</p></div><button class="primary" id="import-btn">＋ Импорт расписания</button></div>
        <div class="notice"><span class="notice-icon">i</span><div><strong>Контролируемый импорт</strong><p>Перечень групп формируется только из верхних строк страниц файла «расписание 13 недели.pdf». Другие документы не могут добавлять группы.</p></div></div>
        <div class="metrics">
          <article class="metric"><span>Группы в черновике</span><strong id="groups-count">${state.approvedGroups.length || '—'}</strong><small>Только из расписания 13-й недели</small></article>
          <article class="metric"><span>Преподаватели</span><strong>—</strong><small>Следующий этап импорта</small></article>
          <article class="metric"><span>Аудитории</span><strong>—</strong><small>Требуется отдельный реестр</small></article>
          <article class="metric"><span>Конфликты</span><strong class="metric-muted">Не проверено</strong><small>Проверка после импорта</small></article>
        </div>
        <div class="section-grid">
          <article class="panel schedule-panel"><div class="panel-head"><div><p class="eyebrow">ПЛАНИРОВАНИЕ</p><h2>Рабочий календарь</h2></div><span class="soft-tag">Черновик</span></div><div class="empty-state"><div class="empty-icon">▦</div><h3>Календарь пока пуст</h3><p>После проверки исходных групп, учебных планов и календарей здесь появится расписание занятий, практик, каникул и аттестаций.</p></div></article>
          <article class="panel checklist-panel"><div class="panel-head"><div><p class="eyebrow">ПОДГОТОВКА</p><h2>Этапы запуска</h2></div></div><ol class="steps"><li class="done"><span>✓</span><div><b>Приватный репозиторий</b><small>Создан и настроен</small></div></li><li class="current"><span>2</span><div><b>Импорт групп из 13-й недели</b><small>Проверка и подтверждение списка</small></div></li><li><span>3</span><div><b>Преподаватели и занятия</b><small>Восстановление связей по колонкам</small></div></li><li><span>4</span><div><b>Учебные планы и календари</b><small>Периоды обучения и нагрузка</small></div></li><li><span>5</span><div><b>Генератор расписания</b><small>Ограничения и оптимизация</small></div></li></ol></article>
        </div>
        <footer>ОКПТ Schedule <span>·</span> Версия 0.2.0 <span>·</span> Импорт в режиме проверки</footer>
      </section>
    </main>
  </div>
  <div class="modal-backdrop" id="import-modal" hidden>
    <section class="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <header class="dialog-head"><div><p class="eyebrow">ИМПОРТ И ПРОВЕРКА</p><h2 id="import-title">Расписание 13-й недели</h2><p class="dialog-sub">Загрузите исходный PDF. Группы будут извлечены только из верхней строки каждой страницы.</p></div><button class="close-btn" id="close-import" aria-label="Закрыть">×</button></header>
      <div class="upload-zone" id="upload-zone"><div class="upload-icon">↑</div><strong>Перетащите PDF сюда или выберите файл</strong><span>Ожидаемый источник: расписание 13 недели.pdf</span><input id="pdf-input" type="file" accept="application/pdf" hidden><button class="secondary" id="choose-pdf">Выбрать PDF</button></div>
      <div class="import-message" id="import-message" aria-live="polite">Файл анализируется в браузере. Он не отправляется в GitHub.</div>
      <div class="review-area" id="review-area" hidden>
        <div class="review-summary"><div><span class="eyebrow">РЕЗУЛЬТАТ ИЗВЛЕЧЕНИЯ</span><h3 id="review-file">—</h3></div><span class="review-status">Требует проверки</span></div>
        <div class="review-meta" id="review-meta"></div>
        <div class="group-review-head"><div><strong>Кандидаты в учебные группы</strong><small>Снимите отметку, если код распознан неверно. Это ещё не утверждённый реестр.</small></div><span id="selected-count">0 выбрано</span></div>
        <div class="group-list" id="group-list"></div>
        <details class="source-details"><summary>Проверить группы по страницам</summary><div id="page-groups" class="page-group-summary"></div></details>
        <details class="source-details"><summary>Показать исходную строку заголовка</summary><p id="source-header"></p></details>
        <details class="source-details"><summary>Предпросмотр извлечённых ячеек расписания</summary><p class="hint">Это пока исходные фрагменты по координатам столбцов. Предмет, преподаватель, кабинет и подгруппа ещё не разделены автоматически.</p><div class="preview-filters"><label>Страница<select id="preview-page"><option value="all">Все</option></select></label><label>Группа<select id="preview-group"><option value="all">Все</option></select></label></div><div id="cell-preview" class="cell-preview"></div></details>
        <div class="dialog-actions"><button class="text-button" id="reset-import">Сбросить результат</button><button class="primary" id="approve-groups" disabled>Подтвердить список групп</button></div>
      </div>
      <div class="dialog-footnote">Подтверждение сохраняет черновик только в памяти этой вкладки. Постоянное сохранение и импорт остальных сущностей будут добавлены после проверки точности извлечения.</div>
    </section>
  </div>
`

const titles = Object.fromEntries(sections)
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'))
    button.classList.add('active')
    state.activeSection = button.dataset.section
    const label = titles[state.activeSection]
    document.querySelector('#section-title').textContent = label
    document.querySelector('#page-heading').textContent = label
    if (state.activeSection === 'groups' && state.approvedGroups.length) {
      document.querySelector('.schedule-panel .empty-state h3').textContent = 'Группы проверены в текущем сеансе'
      document.querySelector('.schedule-panel .empty-state p').textContent = state.approvedGroups.join(' · ')
    }
  })
})

const modal = document.querySelector('#import-modal')
const fileInput = document.querySelector('#pdf-input')
const uploadZone = document.querySelector('#upload-zone')
const reviewArea = document.querySelector('#review-area')
const message = document.querySelector('#import-message')
const approveButton = document.querySelector('#approve-groups')

function openImport() { modal.hidden = false; document.body.classList.add('modal-open') }
function closeImport() { modal.hidden = true; document.body.classList.remove('modal-open') }
document.querySelector('#import-btn').addEventListener('click', openImport)
document.querySelector('#close-import').addEventListener('click', closeImport)
modal.addEventListener('click', event => { if (event.target === modal) closeImport() })
document.querySelector('#choose-pdf').addEventListener('click', () => fileInput.click())

function selectedGroups() {
  return [...document.querySelectorAll('.group-check:checked')].map(input => input.value)
}
function updateSelectedCount() {
  const count = selectedGroups().length
  document.querySelector('#selected-count').textContent = `${count} выбрано`
  approveButton.disabled = count === 0
}
function renderImport(result) {
  state.importResult = result
  reviewArea.hidden = false
  document.querySelector('#review-file').textContent = result.filename
  const reviewMeta = document.querySelector('#review-meta')
  reviewMeta.replaceChildren()
  for (const label of [`${result.pageCount} стр.`, `${result.groups.length} кандидатов групп`, `${result.rawCellBlockCount ?? 0} блоков текста`, 'Статус: не подтверждено']) {
    const item = document.createElement('span')
    item.textContent = label
    reviewMeta.append(item)
  }
  const groupList = document.querySelector('#group-list')
  groupList.replaceChildren()
  for (const group of result.groups) {
    const label = document.createElement('label')
    label.className = 'group-option'
    const input = document.createElement('input')
    input.className = 'group-check'
    input.type = 'checkbox'
    input.value = group
    input.checked = true
    const name = document.createElement('span')
    name.textContent = group
    const source = document.createElement('small')
    source.textContent = 'из заголовка'
    label.append(input, name, source)
    groupList.append(label)
  }
  document.querySelector('#source-header').textContent = result.headerLine
  const pageGroups = document.querySelector('#page-groups')
  pageGroups.replaceChildren()
  for (const page of result.pageSummaries) {
    const row = document.createElement('p')
    const heading = document.createElement('strong')
    heading.textContent = `Страница ${page.page} · ${page.headerGroupCount} групп: `
    const codes = document.createElement('span')
    codes.textContent = (page.groups || []).join(', ')
    row.append(heading, codes)
    pageGroups.append(row)
  }
  const preview = document.querySelector('#cell-preview')
  const pageSelect = document.querySelector('#preview-page')
  const groupSelect = document.querySelector('#preview-group')
  const blocks = result.rawCellBlocks || []
  pageSelect.replaceChildren(new Option('Все', 'all'))
  for (const page of result.pageSummaries) pageSelect.add(new Option(String(page.page), String(page.page)))
  groupSelect.replaceChildren(new Option('Все', 'all'))
  for (const group of result.groups) groupSelect.add(new Option(group, group))
  const drawPreview = () => {
    preview.replaceChildren()
    const filtered = blocks.filter(block =>
      (pageSelect.value === 'all' || String(block.page) === pageSelect.value) &&
      (groupSelect.value === 'all' || block.group === groupSelect.value)
    )
    const summary = document.createElement('p')
    summary.textContent = `Найдено блоков: ${filtered.length} из ${result.rawCellBlockCount ?? blocks.length}`
    preview.append(summary)
    for (const block of filtered.slice(0, 160)) {
      const item = document.createElement('div')
      item.className = 'cell-sample'
      const meta = document.createElement('small')
      meta.textContent = `Стр. ${block.page} · группа ${block.group} · координата Y ${block.yStart}–${block.yEnd}`
      const raw = document.createElement('p')
      raw.textContent = block.rawText
      item.append(meta, raw)
      preview.append(item)
    }
    if (filtered.length > 160) {
      const note = document.createElement('p')
      note.textContent = 'Показаны первые 160 блоков. Уточните страницу или группу для просмотра остальных.'
      preview.append(note)
    }
  }
  pageSelect.onchange = drawPreview
  groupSelect.onchange = drawPreview
  drawPreview()
  document.querySelectorAll('.group-check').forEach(input => input.addEventListener('change', updateSelectedCount))
  updateSelectedCount()
  message.textContent = 'Извлечение завершено. Проверьте каждый код группы перед подтверждением.'
  message.className = 'import-message success'
}

async function handleFile(file) {
  reviewArea.hidden = true
  approveButton.disabled = true
  message.textContent = 'Читаю PDF: определяю столбцы групп и собираю исходные блоки ячеек…'
  message.className = 'import-message'
  try {
    const result = await inspectTimetablePdf(file)
    renderImport(result)
  } catch (error) {
    message.textContent = error?.message || 'Не удалось прочитать PDF.'
    message.className = 'import-message error'
  }
}
fileInput.addEventListener('change', event => {
  const file = event.target.files?.[0]
  if (file) handleFile(file)
})
uploadZone.addEventListener('dragover', event => { event.preventDefault(); uploadZone.classList.add('dragging') })
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'))
uploadZone.addEventListener('drop', event => {
  event.preventDefault()
  uploadZone.classList.remove('dragging')
  const file = event.dataTransfer.files?.[0]
  if (file) handleFile(file)
})
document.querySelector('#reset-import').addEventListener('click', () => {
  state.importResult = null
  fileInput.value = ''
  reviewArea.hidden = true
  message.textContent = 'Результат сброшен. Выберите исходный PDF.'
  message.className = 'import-message'
})
approveButton.addEventListener('click', () => {
  state.approvedGroups = selectedGroups()
  document.querySelector('#groups-count').textContent = state.approvedGroups.length
  document.querySelector('.notice strong').textContent = 'Список групп подтверждён в черновике'
  document.querySelector('.notice p').textContent = `Подтверждено ${state.approvedGroups.length} кодов групп из расписания 13-й недели. Данные ещё не сохранены в постоянную базу.`
  message.textContent = `Черновик перечня групп подтверждён: ${state.approvedGroups.length}. Можно переходить к проверке занятий и преподавателей.`
  message.className = 'import-message success'
  approveButton.textContent = 'Список подтверждён'
  approveButton.disabled = true
})
