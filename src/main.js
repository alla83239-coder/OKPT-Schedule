import './style.css'
import * as XLSX from 'xlsx'
import { DEMO_DATA } from './demo-data.js'

const DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
const SLOTS={
  'Понедельник':['09:25–10:10','10:15–11:00','11:10–11:55','12:00–12:45','13:15–13:55','14:00–14:45','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Вторник':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Среда':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Четверг':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Пятница':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Суббота':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40']
}
const STORAGE='okpt-scheduler-prototype-v4'
const blank=structuredClone(DEMO_DATA)
let data=load(),tab='week',editingId=null,deptFilter='Все отделения'
function load(){try{const s=localStorage.getItem(STORAGE);return s?{...structuredClone(blank),...JSON.parse(s)}:structuredClone(blank)}catch{return structuredClone(blank)}}
function save(){localStorage.setItem(STORAGE,JSON.stringify(data));render()}
function id(){return crypto.randomUUID?.()||String(Date.now()+Math.random())}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dept(g){return data.groupDepartments?.[g]||'Не распределено'}
function groupPlan(g){return data.curricula.find(p=>p.id===data.groupCurricula?.[g])}
function subjectsFor(g){return groupPlan(g)?.subjects||data.subjects||[]}
function weekDate(i){const d=new Date(data.week+'T12:00:00');d.setDate(d.getDate()+i);return d}
function fmtDate(d){return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}
function groupBusy(a,b){return a.group===b.group&&(!a.subgroup||!b.subgroup||a.subgroup===b.subgroup)}
function conflicts(candidate,excludeId=null){
 return data.lessons.filter(x=>x.id!==excludeId&&x.day===candidate.day&&x.slot===candidate.slot&&(
  groupBusy(candidate,x)||(candidate.teacher&&candidate.teacher===x.teacher)||(candidate.room&&candidate.room===x.room)
 )).map(x=>({x,reason:groupBusy(candidate,x)?'Группа/подгруппа уже занята':candidate.teacher&&candidate.teacher===x.teacher?'Преподаватель уже занят':'Аудитория уже занята'}))
}
function visibleGroups(){return data.groups.filter(g=>deptFilter==='Все отделения'||dept(g)===deptFilter)}
function render(){
 const root=document.querySelector('#app')
 const total=data.lessons.length,issues=data.lessons.reduce((n,x)=>n+(conflicts(x,x.id).length?1:0),0)
 root.innerHTML=`
 <div class="app-shell">
  <aside class="sidebar"><div class="brand"><div class="brand-mark">О</div><div><b>ОКПТ</b><small>Планировщик расписания</small></div></div>
   <div class="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
   <button class="side-link ${tab==='week'?'active':''}" data-tab="week">▦ <span>Недельное расписание</span></button>
   <button class="side-link ${tab==='lists'?'active':''}" data-tab="lists">☷ <span>Справочники</span></button>
   <button class="side-link ${tab==='plans'?'active':''}" data-tab="plans">▤ <span>Учебные планы</span></button>
   <button class="side-link ${tab==='replacements'?'active':''}" data-tab="replacements">↔ <span>Замены</span></button>
   <button class="side-link ${tab==='rules'?'active':''}" data-tab="rules">✓ <span>Контроль конфликтов</span></button>
   <div class="sidebar-bottom demo-status"><i></i><div><b>Демонстрационный режим</b><small>Общие стартовые справочники из GitHub</small></div></div>
  </aside>
  <main class="main"><header class="topbar"><div><span>ОКПТ</span>　/　<b>${({week:'Недельное расписание',lists:'Справочники',plans:'Учебные планы',replacements:'Замены',rules:'Контроль расписания'})[tab]}</b></div><div class="top-right"><span class="year-chip">ДЕМО · 2026 / 2027</span><button class="btn light" id="reset-demo">↺ Сбросить демо</button><button class="btn gold" id="export">↓ Экспорт Excel</button></div></header>
   <section class="page"><div class="page-head"><div><p class="eyebrow">ДИСПЕТЧЕРСКАЯ · УЧЕБНЫЙ ГОД 2026/2027</p><h1>${({week:'Составление расписания на неделю',lists:'Справочники колледжа',plans:'Привязка учебных планов',replacements:'Замены в расписании',rules:'Контроль ограничений'})[tab]}</h1><p class="muted">${({week:'Занятия, группы, преподаватели и аудитории в единой недельной сетке.',lists:'Общие справочники колледжа с разделением групп по отделениям.',plans:'Дисциплины выбираются из плана, назначенного конкретной группе.',replacements:'Оформление замены без потери исходного занятия и истории изменений.',rules:'Проверка пересечений и ограничений по введённым занятиям.'})[tab]}</p><div class="demo-banner"><b>Прототип для демонстрации.</b> В репозитории доступны 59 кодов групп и 99 преподавательских записей, извлечённых из расписания 13-й недели. Аудитории добавлены по обозначениям, встречающимся в том же файле. Отделения и официальные учебные планы пока требуют сверки. Изменения на этом этапе сохраняются в браузере, а не синхронизируются между сотрудниками.</div></div>${tab==='week'?'<button class="btn gold" id="add-lesson">＋ Добавить занятие</button>':''}</div>
   <div class="stats"><div class="stat"><small>Занятий на неделе</small><b>${total}</b></div><div class="stat"><small>Групп</small><b>${data.groups.length}</b></div><div class="stat"><small>Преподавателей</small><b>${data.teachers.length}</b></div><div class="stat"><small>Пересечений</small><b class="${issues?'red':'green'}">${issues}</b></div></div>
   ${tab==='week'?weekView():tab==='lists'?listsView():tab==='plans'?plansView():tab==='replacements'?replacementsView():rulesView()}
   <footer>ОКПТ · Прототип планировщика · Исходные справочники: расписание 13-й недели 2026</footer></section></main></div>
 <div class="modal-backdrop" id="modal" hidden><section class="modal"><div class="modal-head"><div><p class="eyebrow">РАСПИСАНИЕ</p><h2 id="modal-title">Новое занятие</h2></div><button class="close" id="close">×</button></div><form id="lesson-form"><div class="form-grid">
 <label>Отделение<select name="department">${data.departments.filter(x=>x!=='Не распределено').map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
 <label>Учебная группа<select name="group" required>${data.groups.map(g=>`<option value="${esc(g)}">${esc(g)} · ${esc(dept(g))}</option>`).join('')}</select></label>
 <label>Подгруппа<select name="subgroup"><option value="">Вся группа</option><option>1 подгруппа</option><option>2 подгруппа</option></select></label>
 <label>День недели<select name="day">${DAYS.map(x=>`<option>${x}</option>`).join('')}</select></label>
 <label>Урок / время<select name="slot" id="slot-select"></select></label>
 <label class="wide">Дисциплина<select name="subject" id="subject-select" required></select></label>
 <label>Преподаватель<input name="teacher" list="teacher-options" placeholder="Фамилия И.О."><datalist id="teacher-options">${data.teachers.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
 <label>Аудитория<input name="room" list="room-options" placeholder="Номер / название"><datalist id="room-options">${data.rooms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
 <label class="wide">Примечание<input name="note" placeholder="Необязательно"></label></div><div id="form-alert" class="form-alert" hidden></div><div class="modal-actions"><button type="button" class="btn light" id="cancel">Отмена</button><button class="btn gold" type="submit">Сохранить занятие</button></div></form></section></div>
 <div class="modal-backdrop" id="sub-modal" hidden><section class="modal"><div class="modal-head"><div><p class="eyebrow">КАДРОВОЕ ИЗМЕНЕНИЕ</p><h2>Оформить замену</h2></div><button class="close" id="sub-close">×</button></div><form id="sub-form"><div class="form-grid"><label class="wide">Исходное занятие<select name="lesson" required>${data.lessons.map(x=>`<option value="${x.id}">${esc(x.day)} · ${esc(x.slot)} · ${esc(x.group)} · ${esc(x.subject)} · ${esc(x.teacher)}</option>`).join('')}</select></label><label>Новый преподаватель<input name="teacher" list="teacher-options"></label><label>Новая аудитория<input name="room" list="room-options"></label><label>Причина замены<input name="reason" required placeholder="Например, больничный"></label><label>Статус<select name="status"><option>На согласовании</option><option>Утверждена</option></select></label></div><div id="sub-alert" class="form-alert" hidden></div><div class="modal-actions"><button type="button" class="btn light" id="sub-cancel">Отмена</button><button class="btn gold" type="submit">Сохранить замену</button></div></form></section></div>`
 bind()
}
function weekView(){
 return `<div class="week-tools"><div class="week-switch"><button class="btn light" id="prev-week">‹</button><label>Неделя с <input type="date" id="week-date" value="${data.week}"></label><button class="btn light" id="next-week">›</button></div><div class="week-switch"><label>Отделение <select id="dept-filter"><option>Все отделения</option>${data.departments.map(d=>`<option ${deptFilter===d?'selected':''}>${esc(d)}</option>`).join('')}</select></label></div></div>
 <div class="schedule-wrap"><table class="schedule"><thead><tr><th class="time-col">Урок</th>${DAYS.map((d,i)=>`<th>${d}<small>${fmtDate(weekDate(i))}</small></th>`).join('')}</tr></thead><tbody>${Array.from({length:11},(_,row)=>`<tr><th class="time-col"><b>${row+1}</b></th>${DAYS.map(day=>{const slot=SLOTS[day][row];if(!slot)return '<td class="no-slot">—</td>';const entries=data.lessons.filter(x=>x.day===day&&x.slot===slot&&visibleGroups().includes(x.group));return `<td class="slot-cell">${entries.map(x=>`<article class="lesson-card ${conflicts(x,x.id).length?'has-conflict':''}" data-edit="${x.id}"><b>${esc(x.group)} ${x.subgroup?'· '+esc(x.subgroup):''}</b><span>${esc(x.subject)}</span><small>${esc(x.teacher||'Преподаватель не указан')} · ${esc(x.room||'ауд. не указана')}</small></article>`).join('')}<button class="add-slot" data-add-day="${day}" data-add-slot="${slot}">＋</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div><p class="under-note">Временные интервалы перенесены из файла «Расписание звонков». Понедельник имеет отдельный график, суббота — 8 уроков.</p>`
}
function listsView(){
 return `<div class="panel"><h2>Распределение групп по отделениям</h2><p class="muted">Коды групп импортированы из расписания. Отделение не угадываем по коду: его можно назначить вручную. Позже сверим с официальным списком групп.</p><div class="table-scroll"><table class="directory"><thead><tr><th>Группа</th><th>Отделение</th><th>Учебный план</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td><b>${esc(g)}</b></td><td><select data-group-dept="${esc(g)}"><option value="Не распределено">Не распределено</option>${data.departments.filter(d=>d!=='Не распределено').map(d=>`<option ${dept(g)===d?'selected':''}>${esc(d)}</option>`).join('')}</select></td><td>${esc(groupPlan(g)?.name||'Не назначен')}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="lists-grid">${[['teachers','Преподаватели','Из расписания 13-й недели.',data.teachers],['rooms','Аудитории и залы','Обозначения из расписания; типы и вместимость уточняются.',data.rooms]].map(([k,t,h,a])=>`<section class="panel"><h2>${t}</h2><p class="muted">${h}</p><textarea id="list-${k}">${esc(a.join('\n'))}</textarea><button class="btn gold save-list" data-list="${k}">Сохранить список</button><small>${a.length} записей</small></section>`).join('')}</div>`
}
function plansView(){
 return `<div class="panel"><h2>Учебные планы</h2><p class="muted">Загружаемая дисциплинарная структура будет назначаться группе. Сейчас официальные файлы учебных планов в проект не приложены, поэтому не подменяем их предположительными данными. Можно создать демонстрационный план и наполнить его дисциплинами.</p><div class="form-grid plan-create"><label>Название плана<input id="plan-name" placeholder="Например, 09.02.07 — Информационные системы"></label><label>Дисциплины (по одной в строке)<textarea id="plan-subjects" placeholder="Математика\nИнформатика\nИстория"></textarea></label><button class="btn gold" id="create-plan">＋ Создать учебный план</button></div></div>
 <div class="panel"><h2>Привязка плана к группе</h2><div class="table-scroll"><table class="directory"><thead><tr><th>Группа</th><th>Отделение</th><th>Учебный план</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td><b>${esc(g)}</b></td><td>${esc(dept(g))}</td><td><select data-group-plan="${esc(g)}"><option value="">Не назначен</option>${data.curricula.map(p=>`<option value="${p.id}" ${data.groupCurricula[g]===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>
 <div class="panel"><h2>Созданные планы</h2>${data.curricula.length?data.curricula.map(p=>`<div class="plan-row"><b>${esc(p.name)}</b><span>${p.subjects.length} дисциплин: ${esc(p.subjects.join(', '))}</span></div>`).join(''):'<p class="muted">Пока нет учебных планов.</p>'}</div>`
}
function replacementsView(){
 return `<div class="panel"><div class="panel-head"><div><h2>Журнал замен</h2><p class="muted">Исходное занятие сохраняется. Замена фиксируется отдельно и может быть согласована.</p></div><button class="btn gold" id="add-substitution" ${data.lessons.length?'':'disabled'}>＋ Оформить замену</button></div>${data.substitutions.length?data.substitutions.map(s=>{const l=data.lessons.find(x=>x.id===s.lessonId);return `<div class="substitution-row"><b>${l?esc(l.group+' · '+l.day+' · '+l.slot+' · '+l.subject):'Исходное занятие удалено'}</b><span>${esc(l?.teacher||'Преподаватель не указан')} → ${esc(s.teacher||l?.teacher||'без изменения')}</span><span>Аудитория: ${esc(s.room||l?.room||'без изменения')} · ${esc(s.reason)}</span><em>${esc(s.status)}</em></div>`}).join(''):'<div class="success-box">Замены ещё не оформлялись. Сначала добавьте занятия в недельную сетку.</div>'}`
}
function rulesView(){
 const issues=[];for(const l of data.lessons)for(const c of conflicts(l,l.id))if(l.id<c.x.id)issues.push({l,reason:c.reason})
 return `<div class="panel"><h2>Проверка пересечений</h2><p class="muted">Система проверяет одновременную занятость преподавателя, аудитории и группы.</p>${issues.length?issues.map(i=>`<div class="issue"><b>${esc(i.l.day)} · ${esc(i.l.slot)}</b> — ${esc(i.l.group)} / ${esc(i.l.subject)}: ${esc(i.reason)}</div>`).join(''):'<div class="success-box">Среди введённых занятий пересечений не обнаружено.</div>'}<ul class="rule-list"><li>Один преподаватель не может вести две пары одновременно в разных группах.</li><li>Одна аудитория не может быть назначена двум занятиям в один временной интервал.</li><li>Группа не может иметь параллельные занятия, если одно из них назначено всей группе.</li><li>Разные подгруппы могут заниматься одновременно, если у них разные преподаватели и аудитории.</li><li>Проверка действует при добавлении и редактировании занятия, а не только в отчёте.</li></ul></div><div class="panel"><h2>Что пока не считается</h2><p class="muted">Нагрузка преподавателей, допустимые дни и часы, лимит 36 академических часов, типы аудиторий, квалификационные соответствия и полный учёт последовательных/параллельных подгрупп будут подключены после получения актуальных списков и заявок.</p></div>`
}
function fillSlots(day,selected=''){document.querySelector('#slot-select').innerHTML=SLOTS[day].map((s,i)=>`<option value="${s}" ${s===selected?'selected':''}>${i+1} урок · ${s}</option>`).join('')}
function fillSubjects(group,selected=''){const arr=subjectsFor(group);const el=document.querySelector('#subject-select');el.innerHTML=(arr.length?arr:['Сначала назначьте учебный план группе']).map(s=>`<option value="${esc(s)}" ${s===selected?'selected':''}>${esc(s)}</option>`).join('');if(!arr.length)el.value=''}
function openLesson(item=null,day=null,slot=null){
 editingId=item?.id||null;const m=document.querySelector('#modal');m.hidden=false;const f=document.querySelector('#lesson-form');document.querySelector('#modal-title').textContent=item?'Редактировать занятие':'Добавить занятие'
 f.elements.group.value=item?.group||data.groups[0]||'';f.elements.department.value=dept(f.elements.group.value)==='Не распределено'?data.departments[0]:dept(f.elements.group.value);f.elements.subgroup.value=item?.subgroup||'';f.elements.day.value=item?.day||day||'Понедельник';f.elements.teacher.value=item?.teacher||'';f.elements.room.value=item?.room||'';f.elements.note.value=item?.note||'';fillSlots(f.elements.day.value,item?.slot||slot||'');fillSubjects(f.elements.group.value,item?.subject||'')
 f.elements.group.onchange=()=>{f.elements.department.value=dept(f.elements.group.value)==='Не распределено'?data.departments[0]:dept(f.elements.group.value);fillSubjects(f.elements.group.value)}
 f.elements.department.onchange=()=>{const choices=data.groups.filter(g=>dept(g)===f.elements.department.value);if(choices.length)f.elements.group.value=choices[0];fillSubjects(f.elements.group.value)}
 f.elements.day.onchange=()=>fillSlots(f.elements.day.value)
}
function closeLesson(){document.querySelector('#modal').hidden=true}
function submitLesson(e){
 e.preventDefault();const f=e.currentTarget;const item={id:editingId||id(),group:f.elements.group.value,subgroup:f.elements.subgroup.value,day:f.elements.day.value,slot:f.elements.slot.value,subject:f.elements.subject.value,teacher:f.elements.teacher.value.trim(),room:f.elements.room.value.trim(),note:f.elements.note.value.trim()}
 if(!item.group||!item.subject||item.subject.startsWith('Сначала'))return alert('Назначьте группе учебный план и выберите дисциплину.')
 const c=conflicts(item,editingId);if(c.length){const a=document.querySelector('#form-alert');a.hidden=false;a.textContent='Нельзя сохранить: '+[...new Set(c.map(x=>x.reason))].join('; ')+'.';return}
 data.lessons=data.lessons.filter(x=>x.id!==editingId);data.lessons.push(item);if(item.teacher&&!data.teachers.includes(item.teacher))data.teachers.push(item.teacher);if(item.room&&!data.rooms.includes(item.room))data.rooms.push(item.room);closeLesson();save()
}
function openSub(){document.querySelector('#sub-modal').hidden=false}
function bind(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()})
 document.querySelector('#export').onclick=exportExcel
 document.querySelector('#reset-demo').onclick=()=>{if(confirm('Вернуть исходные справочники? Все изменения в этом браузере будут сброшены.')){data=structuredClone(blank);save()}}
 if(tab==='week'){
  document.querySelector('#add-lesson').onclick=()=>openLesson()
  document.querySelector('#prev-week').onclick=()=>shiftWeek(-7);document.querySelector('#next-week').onclick=()=>shiftWeek(7)
  document.querySelector('#week-date').onchange=e=>{data.week=e.target.value;save()}
  document.querySelector('#dept-filter').onchange=e=>{deptFilter=e.target.value;render()}
  document.querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>openLesson(null,b.dataset.addDay,b.dataset.addSlot))
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openLesson(data.lessons.find(x=>x.id===b.dataset.edit)))
  document.querySelector('#close').onclick=closeLesson;document.querySelector('#cancel').onclick=closeLesson;document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeLesson()}
  document.querySelector('#lesson-form').onsubmit=submitLesson
 }
 if(tab==='lists'){
  document.querySelectorAll('[data-group-dept]').forEach(s=>s.onchange=()=>{data.groupDepartments[s.dataset.groupDept]=s.value;save()})
  document.querySelectorAll('.save-list').forEach(b=>b.onclick=()=>{const k=b.dataset.list;data[k]=[...new Set(document.querySelector('#list-'+k).value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean))];save()})
 }
 if(tab==='plans'){
  document.querySelector('#create-plan').onclick=()=>{const name=document.querySelector('#plan-name').value.trim(),subjects=[...new Set(document.querySelector('#plan-subjects').value.split(/[\n;]+/).map(x=>x.trim()).filter(Boolean))];if(!name||!subjects.length){alert('Укажите название плана и хотя бы одну дисциплину.');return}data.curricula.push({id:id(),name,subjects});save()}
  document.querySelectorAll('[data-group-plan]').forEach(s=>s.onchange=()=>{data.groupCurricula[s.dataset.groupPlan]=s.value;save()})
 }
 if(tab==='replacements'){
  const b=document.querySelector('#add-substitution');if(b)b.onclick=openSub
  const close=()=>document.querySelector('#sub-modal').hidden=true
  document.querySelector('#sub-close').onclick=close;document.querySelector('#sub-cancel').onclick=close;document.querySelector('#sub-modal').onclick=e=>{if(e.target.id==='sub-modal')close()}
  document.querySelector('#sub-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,l=data.lessons.find(x=>x.id===f.elements.lesson.value);if(!l)return;const teacher=f.elements.teacher.value.trim(),room=f.elements.room.value.trim();const candidate={...l,teacher:teacher||l.teacher,room:room||l.room};const c=conflicts(candidate,l.id);if(c.length){const a=document.querySelector('#sub-alert');a.hidden=false;a.textContent='Замена конфликтует с другим занятием: '+[...new Set(c.map(x=>x.reason))].join('; ');return}data.substitutions.push({id:id(),lessonId:l.id,teacher,room,reason:f.elements.reason.value.trim(),status:f.elements.status.value});save()}
 }
}
function shiftWeek(n){const d=new Date(data.week+'T12:00:00');d.setDate(d.getDate()+n);data.week=d.toISOString().slice(0,10);save()}
function exportExcel(){
 const wb=XLSX.utils.book_new()
 const lessons=data.lessons.map(x=>({'День':x.day,'Время':x.slot,'Группа':x.group,'Отделение':dept(x.group),'Подгруппа':x.subgroup||'Вся группа','Дисциплина':x.subject,'Преподаватель':x.teacher,'Аудитория':x.room,'Примечание':x.note}))
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(lessons.length?lessons:[{'Информация':'Занятия не добавлены'}]),'Расписание')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.groups.map(g=>({'Группа':g,'Отделение':dept(g),'Учебный план':groupPlan(g)?.name||''}))), 'Группы')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.teachers.map(name=>({'Преподаватель':name}))), 'Преподаватели')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.rooms.map(name=>({'Аудитория':name}))), 'Аудитории')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.substitutions.map(s=>{const l=data.lessons.find(x=>x.id===s.lessonId);return {'Группа':l?.group,'Занятие':l?.subject,'Исходный преподаватель':l?.teacher,'Новый преподаватель':s.teacher,'Новая аудитория':s.room,'Причина':s.reason,'Статус':s.status}})), 'Замены')
 XLSX.writeFile(wb,'ОКПТ_расписание_'+data.week+'.xlsx')
}
render()
