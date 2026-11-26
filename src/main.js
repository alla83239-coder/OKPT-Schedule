import './style.css'
import * as XLSX from 'xlsx'
import { DEMO_DATA } from './demo-data.js'

const DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
const SLOTS = {
  'Понедельник': ['09:25–10:10','10:15–11:00','11:10–11:55','12:00–12:45','13:15–13:55','14:00–14:45','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Вторник': ['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Среда': ['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Четверг': ['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Пятница': ['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Суббота': ['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40']
}
const STORAGE = 'okpt-weekly-scheduler-demo-v3'
const blank = structuredClone(DEMO_DATA)
let data = load()
let editingId = null
let activeTab = 'week'

function load() {
  try { const saved = localStorage.getItem(STORAGE); return saved ? { ...structuredClone(blank), ...JSON.parse(saved) } : structuredClone(blank) }
  catch { return structuredClone(blank) }
}
function save() { localStorage.setItem(STORAGE, JSON.stringify(data)); render() }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()) }
function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function weekDate(dayIndex) { const d = new Date(data.week+'T12:00:00'); d.setDate(d.getDate()+dayIndex); return d }
function fmtDate(d) { return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}) }
function lessonsFor(day, slot) { return data.lessons.filter(x=>x.day===day && x.slot===slot) }
function clash(candidate, excludeId=null) {
  return data.lessons.filter(x=>x.id!==excludeId && x.day===candidate.day && x.slot===candidate.slot && (
    (candidate.group===x.group && candidate.subgroup===x.subgroup) ||
    (candidate.teacher && candidate.teacher===x.teacher) ||
    (candidate.room && candidate.room===x.room)
  )).map(x => {
    if (candidate.group===x.group && candidate.subgroup===x.subgroup) return 'Группа уже занята'
    if (candidate.teacher && candidate.teacher===x.teacher) return 'Преподаватель уже занят'
    return 'Аудитория уже занята'
  })
}
function weekHours(group) { return data.lessons.filter(x=>x.group===group).length }
function weekDayCount(group, day) { return data.lessons.filter(x=>x.group===group && x.day===day).length }
function render() {
  const root = document.querySelector('#app')
  const total = data.lessons.length
  const conflictCount = data.lessons.reduce((n,x)=>n+(clash(x,x.id).length>0?1:0),0)
  root.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">О</div><div><b>ОКПТ</b><small>Планировщик расписания</small></div></div>
      <div class="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <button class="side-link ${activeTab==='week'?'active':''}" data-tab="week">▦ <span>Недельное расписание</span></button>
      <button class="side-link ${activeTab==='lists'?'active':''}" data-tab="lists">☷ <span>Справочники</span></button>
      <button class="side-link ${activeTab==='rules'?'active':''}" data-tab="rules">✓ <span>Проверка ограничений</span></button>
      <div class="sidebar-bottom demo-status"><i></i><div><b>Демонстрационный режим</b><small>Стартовые данные загружаются из GitHub</small></div></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><span>ОКПТ</span>　/　<b>${activeTab==='week'?'Недельное расписание':activeTab==='lists'?'Справочники':'Проверка'}</b></div><div class="top-right"><span class="year-chip">ДЕМО · 2026 / 2027</span><button class="btn light" id="reset-demo">↺ Сбросить демо</button><button class="btn gold" id="export">↓ Экспорт Excel</button></div></header>
      <section class="page">
        <div class="page-head"><div><p class="eyebrow">ДИСПЕТЧЕРСКАЯ · УЧЕБНЫЙ ГОД 2026/2027</p><h1>${activeTab==='week'?'Составление расписания на неделю':activeTab==='lists'?'Справочники расписания':'Контроль расписания'}</h1><p class="muted">${activeTab==='week'?'Добавляйте занятия по группам, преподавателям и аудиториям. Конфликты проверяются автоматически.':'Черновик можно редактировать и выгружать в Excel в любой момент.'}</p><div class="demo-banner"><b>Общие стартовые справочники.</b> 59 кодов групп и 99 преподавательских записей извлечены из расписания 13-й недели и загружаются из GitHub на любом компьютере. Список преподавателей пока не является полным кадровым реестром. Новые занятия и изменения пока сохраняются только в текущем браузере.</div></div><button class="btn gold" id="add-lesson">＋ Добавить занятие</button></div>
        <div class="stats">
          <div class="stat"><small>Занятий на неделе</small><b>${total}</b></div>
          <div class="stat"><small>Учебных групп</small><b>${data.groups.length}</b></div>
          <div class="stat"><small>Преподавателей</small><b>${data.teachers.length}</b></div>
          <div class="stat"><small>Конфликтов</small><b class="${conflictCount?'red':'green'}">${conflictCount}</b></div>
        </div>
        ${activeTab==='week'?weekView():activeTab==='lists'?listsView():rulesView()}
        <footer>ОКПТ · Прототип планировщика · Справочники: расписание 13-й недели 2026</footer>
      </section>
    </main>
  </div>
  <div class="modal-backdrop" id="modal" hidden><section class="modal"><div class="modal-head"><div><p class="eyebrow">РАСПИСАНИЕ</p><h2 id="modal-title">Новое занятие</h2></div><button class="close" id="close">×</button></div><form id="lesson-form">
    <div class="form-grid">
      <label>Учебная группа<input name="group" list="group-options" required placeholder="Например, 101-9"><datalist id="group-options">${data.groups.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
      <label>Подгруппа<select name="subgroup"><option value="">Вся группа</option><option>1 подгруппа</option><option>2 подгруппа</option><option>1/2 подгруппы</option></select></label>
      <label>День недели<select name="day">${DAYS.map(x=>`<option ${x===data.activeDay?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Урок / время<select name="slot" id="slot-select"></select></label>
      <label class="wide">Дисциплина<input name="subject" required placeholder="Название дисциплины"></label>
      <label>Преподаватель<input name="teacher" list="teacher-options" placeholder="Фамилия И.О."><datalist id="teacher-options">${data.teachers.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
      <label>Аудитория<input name="room" list="room-options" placeholder="Например, 406"><datalist id="room-options">${data.rooms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
      <label class="wide">Примечание<input name="note" placeholder="Необязательно"></label>
    </div>
    <div id="form-alert" class="form-alert" hidden></div>
    <div class="modal-actions"><button type="button" class="btn light" id="cancel">Отмена</button><button class="btn gold" type="submit">Сохранить занятие</button></div>
  </form></section></div>`
  bind()
}
function weekView() {
  const days = DAYS
  return `<div class="week-tools"><div class="week-switch"><button class="btn light" id="prev-week">‹</button><label>Неделя с <input type="date" id="week-date" value="${data.week}"></label><button class="btn light" id="next-week">›</button></div><div class="legend"><span><i class="dot"></i> Занятие</span><span><i class="dot warn"></i> Конфликт</span></div></div>
  <div class="schedule-wrap"><table class="schedule"><thead><tr><th class="time-col">Урок</th>${days.map((d,i)=>`<th>${d}<small>${fmtDate(weekDate(i))}</small></th>`).join('')}</tr></thead><tbody>${Array.from({length:11},(_,row)=>`<tr><th class="time-col"><b>${row+1}</b><small>${row<6?'основное время':''}</small></th>${days.map(day=>{const slot=SLOTS[day][row];if(!slot)return '<td class="no-slot">—</td>';const entries=lessonsFor(day,slot);return `<td data-day="${day}" data-slot="${slot}" class="slot-cell">${entries.map(x=>`<article class="lesson-card ${clash(x,x.id).length?'has-conflict':''}" data-edit="${x.id}"><b>${esc(x.group)} ${x.subgroup?'· '+esc(x.subgroup):''}</b><span>${esc(x.subject)}</span><small>${esc(x.teacher||'Преподаватель не указан')} · ${esc(x.room||'ауд. не указана')}</small></article>`).join('')}<button class="add-slot" data-add-day="${day}" data-add-slot="${slot}" title="Добавить занятие">＋</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="under-note">Временные интервалы основаны на загруженном расписании звонков. Понедельник отличается от вторника–пятницы; суббота содержит 8 уроков. Пока расписание составляется по отдельным урокам, не по условным 90-минутным парам.</div>`
}
function listsView() {
  return `<div class="lists-grid">${[['groups','Учебные группы','Добавляйте коды групп через запятую или с новой строки.',data.groups],['teachers','Преподаватели','Справочник преподавателей.',data.teachers],['rooms','Аудитории','Номера кабинетов, залов и мастерских.',data.rooms]].map(([key,title,help,arr])=>`<section class="panel"><h2>${title}</h2><p class="muted">${help}</p><textarea id="list-${key}" placeholder="Введите значения, каждое с новой строки">${esc(arr.join('\n'))}</textarea><button class="btn gold save-list" data-list="${key}">Сохранить список</button><small>${arr.length} записей</small></section>`).join('')}</div>`
}
function rulesView() {
  const issues = data.lessons.flatMap(x=>clash(x,x.id).map(reason=>({x,reason})))
  const byGroup = data.groups.map(g=>({g,n:weekHours(g)})).filter(x=>x.n>36)
  return `<div class="panel"><h2>Проверка конфликтов и нагрузки</h2><p class="muted">Проверяются пересечения группы (с учётом подгруппы), преподавателя и аудитории в один и тот же урок.</p>${issues.length?issues.map(({x,reason})=>`<div class="issue"><b>${esc(x.day)}, ${esc(x.slot)}</b> · ${esc(x.group)} · ${esc(x.subject)} — <em>${reason}</em></div>`).join(''):'<div class="success-box">Явных пересечений по введённым данным нет.</div>'}${byGroup.map(x=>`<div class="issue">Группа ${esc(x.g)}: ${x.n} уроков за неделю — проверьте лимит 36 академических часов.</div>`).join('')}</div><div class="panel"><h2>Ограничения MVP</h2><ul class="rule-list"><li>Одновременно нельзя назначить одного преподавателя на два занятия.</li><li>Нельзя занять одну аудиторию двумя занятиями.</li><li>Одна и та же группа и подгруппа не могут иметь два занятия одновременно.</li><li>Разные подгруппы могут заниматься параллельно при разных преподавателях и аудиториях.</li><li>Нагрузка считается по числу введённых уроков; это предварительная проверка, не расчёт тарификации часов.</li></ul></div>`
}
function openModal(item=null, day=null, slot=null) {
  editingId=item?.id||null
  const modal=document.querySelector('#modal'); modal.hidden=false
  document.querySelector('#modal-title').textContent=item?'Редактировать занятие':'Добавить занятие'
  const form=document.querySelector('#lesson-form')
  for(const key of ['group','subgroup','day','subject','teacher','room','note']) form.elements[key].value=item?.[key]??(key==='day'?(day||data.activeDay):'')
  fillSlots(form.elements.day.value,item?.slot||slot||'')
  form.elements.day.onchange=()=>fillSlots(form.elements.day.value,'')
}
function fillSlots(day, selected) {
  const select=document.querySelector('#slot-select')
  select.innerHTML=SLOTS[day].map((s,i)=>`<option value="${s}" ${s===selected?'selected':''}>${i+1} урок · ${s}</option>`).join('')
}
function bind() {
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;render()})
  document.querySelector('#add-lesson').onclick=()=>openModal()
  document.querySelector('#export').onclick=exportExcel
  document.querySelector('#reset-demo').onclick=()=>{if(confirm('Вернуть исходный демонстрационный набор? Все локальные изменения в этом браузере будут заменены.')){data=structuredClone(blank);save()}}
  document.querySelector('#prev-week').onclick=()=>{const d=new Date(data.week+'T12:00:00');d.setDate(d.getDate()-7);data.week=d.toISOString().slice(0,10);save()}
  document.querySelector('#next-week').onclick=()=>{const d=new Date(data.week+'T12:00:00');d.setDate(d.getDate()+7);data.week=d.toISOString().slice(0,10);save()}
  document.querySelector('#week-date').onchange=e=>{data.week=e.target.value;save()}
  document.querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>openModal(null,b.dataset.addDay,b.dataset.addSlot))
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(data.lessons.find(x=>x.id===b.dataset.edit)))
  document.querySelectorAll('.save-list').forEach(b=>b.onclick=()=>{const key=b.dataset.list;data[key]=[...new Set(document.querySelector('#list-'+key).value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean))];save()})
  document.querySelector('#close').onclick=closeModal
  document.querySelector('#cancel').onclick=closeModal
  document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()}
  document.querySelector('#lesson-form').onsubmit=submitLesson
}
function closeModal(){document.querySelector('#modal').hidden=true}
function submitLesson(e) {
  e.preventDefault()
  const f=e.currentTarget
  const item=Object.fromEntries(['group','subgroup','day','slot','subject','teacher','room','note'].map(k=>[k,f.elements[k].value.trim()]))
  item.id=editingId||uid()
  if(!item.group||!item.subject){showAlert('Укажи учебную группу и дисциплину.');return}
  const conflicts=clash(item,editingId)
  if(conflicts.length){showAlert('Нельзя сохранить: '+[...new Set(conflicts)].join('; ')+'. Измени время, группу, подгруппу, преподавателя или аудиторию.');return}
  data.lessons=data.lessons.filter(x=>x.id!==editingId)
  data.lessons.push(item)
  if(!data.groups.includes(item.group))data.groups.push(item.group)
  if(item.teacher&&!data.teachers.includes(item.teacher))data.teachers.push(item.teacher)
  if(item.room&&!data.rooms.includes(item.room))data.rooms.push(item.room)
  closeModal();save()
}
function showAlert(text){const el=document.querySelector('#form-alert');el.hidden=false;el.textContent=text}
function exportExcel() {
  const rows=data.lessons.slice().sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||SLOTS[a.day].indexOf(a.slot)-SLOTS[b.day].indexOf(b.slot)).map(x=>({'День':x.day,'Дата':fmtDate(weekDate(DAYS.indexOf(x.day))),'Урок':SLOTS[x.day].indexOf(x.slot)+1,'Время':x.slot,'Группа':x.group,'Подгруппа':x.subgroup||'Вся группа','Дисциплина':x.subject,'Преподаватель':x.teacher,'Аудитория':x.room,'Примечание':x.note}))
  const wb=XLSX.utils.book_new()
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'Информация':'На выбранную неделю занятия не добавлены'}])
  ws['!cols']=[{wch:16},{wch:12},{wch:8},{wch:16},{wch:14},{wch:18},{wch:30},{wch:24},{wch:14},{wch:25}]
  XLSX.utils.book_append_sheet(wb,ws,'Расписание недели')
  const byGroup={}
  for(const x of data.lessons){(byGroup[x.group]??=[]).push(x)}
  const summary=Object.entries(byGroup).map(([group,arr])=>({'Группа':group,'Количество уроков':arr.length,'Дней с занятиями':new Set(arr.map(x=>x.day)).size}))
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary.length?summary:[{'Информация':'Нет данных'}]),'Нагрузка групп')
  XLSX.writeFile(wb,'Расписание_ОКПТ_'+data.week+'.xlsx')
}
render()
