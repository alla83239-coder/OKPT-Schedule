import './style.css'

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

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">О</div>
        <div><strong>ОКПТ</strong><span>Управление расписанием</span></div>
      </div>
      <div class="side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav class="nav" aria-label="Основная навигация">
        ${sections.map(([id, label], i) => `<button class="nav-item ${i === 0 ? 'active' : ''}" data-section="${id}"><span class="nav-dot"></span>${label}</button>`).join('')}
      </nav>
      <div class="sidebar-bottom">
        <span class="status-dot"></span>
        <div><strong>Локальный прототип</strong><small>Данные пока не импортированы</small></div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="crumb">ОКПТ <span>/</span> <b id="section-title">Обзор</b></div>
        <div class="top-actions"><span class="year-chip">2026 / 2027</span><button class="avatar" aria-label="Профиль">А</button></div>
      </header>
      <section class="content">
        <div class="welcome-row">
          <div><p class="eyebrow">ДИСПЕТЧЕРСКАЯ · УЧЕБНЫЙ ГОД 2026/2027</p><h1 id="page-heading">Обзор расписания</h1><p class="subheading">Единое пространство для планирования, контроля нагрузки и управления заменами.</p></div>
          <button class="primary" id="import-btn">＋ Подготовить импорт</button>
        </div>
        <div class="notice"><span class="notice-icon">i</span><div><strong>Режим подготовки данных</strong><p>Сейчас отображается интерфейсный прототип. Реальные группы, преподаватели и занятия появятся после проверки и импорта исходных документов.</p></div></div>
        <div class="metrics">
          <article class="metric"><span>Учебные группы</span><strong>—</strong><small>Источник: расписание 13-й недели</small></article>
          <article class="metric"><span>Преподаватели</span><strong>—</strong><small>Сопоставление с расписанием</small></article>
          <article class="metric"><span>Аудитории</span><strong>—</strong><small>Реестр ещё не загружен</small></article>
          <article class="metric"><span>Конфликты</span><strong class="metric-muted">Не проверено</strong><small>Проверка после импорта</small></article>
        </div>
        <div class="section-grid">
          <article class="panel schedule-panel">
            <div class="panel-head"><div><p class="eyebrow">ПЛАНИРОВАНИЕ</p><h2>Рабочий календарь</h2></div><span class="soft-tag">Черновик</span></div>
            <div class="empty-state"><div class="empty-icon">▦</div><h3>Календарь пока пуст</h3><p>После импорта учебных планов и графиков здесь появится календарь занятий, практик, каникул и аттестаций.</p></div>
          </article>
          <article class="panel checklist-panel">
            <div class="panel-head"><div><p class="eyebrow">ПОДГОТОВКА</p><h2>Этапы запуска</h2></div></div>
            <ol class="steps">
              <li class="done"><span>✓</span><div><b>Репозиторий создан</b><small>Приватный проект GitHub</small></div></li>
              <li class="current"><span>2</span><div><b>Анализ исходных документов</b><small>Проверка структуры и извлечения</small></div></li>
              <li><span>3</span><div><b>Реестр групп и преподавателей</b><small>Сверка источников</small></div></li>
              <li><span>4</span><div><b>Правила и ограничения</b><small>Нагрузка, кабинеты, подгруппы</small></div></li>
              <li><span>5</span><div><b>Генератор расписания</b><small>Автоматическая оптимизация</small></div></li>
            </ol>
          </article>
        </div>
        <footer>ОКПТ Schedule <span>·</span> Версия 0.1.0 <span>·</span> Прототип без производственных данных</footer>
      </section>
    </main>
  </div>
`

const titles = Object.fromEntries(sections)
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'))
    button.classList.add('active')
    const label = titles[button.dataset.section]
    document.querySelector('#section-title').textContent = label
    document.querySelector('#page-heading').textContent = label
  })
})

document.querySelector('#import-btn').addEventListener('click', () => {
  window.alert('Модуль импорта будет подключён после завершения проверки структуры исходных документов.')
})
