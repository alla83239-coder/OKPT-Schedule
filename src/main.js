import './style.css'
import * as XLSX from 'xlsx'
import { DEMO_DATA } from './demo-data.js'
import { REPLACEMENT_REVIEW } from './replacement-review-data.js'
import WEEK13_CSV from './data/week13-assignments-draft.csv?raw'


function parseWeek13Csv(raw){
 const text=String(raw||'').replace(/^\uFEFF/,'').trim(),lines=text.split(/\r?\n/);
 const parseLine=line=>{const out=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&q){v+='"';i++}else if(c==='"')q=!q;else if(c===','&&!q){out.push(v);v=''}else v+=c}out.push(v);return out};
 const head=parseLine(lines.shift()||'');return lines.filter(Boolean).map(line=>{const a=parseLine(line),o={};head.forEach((k,i)=>o[k]=a[i]||'');return o})
}
const WEEK13_ASSIGNMENTS=parseWeek13Csv(WEEK13_CSV);

const DAYS=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
const SLOTS={
  'Понедельник':['09:25–10:10','10:15–11:00','11:10–11:55','12:00–12:45','13:15–13:55','14:00–14:45','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Вторник':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Среда':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Четверг':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Пятница':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40','15:50–16:35','16:40–17:25','17:35–18:20'],
  'Суббота':['08:30–09:15','09:20–10:05','10:15–11:00','11:05–11:50','12:20–13:05','13:10–13:55','14:05–14:50','14:55–15:40']
}
const STORAGE='okpt-scheduler-prototype-v7'
const blank=structuredClone(DEMO_DATA)
let data=load(),tab='week',editingId=null,deptFilter='Все отделения';window.__okptGroupFilter='Все группы';window.__okptScheduleMode='group';window.__okptEntityFilter='Все'
function normalizeNames(values){const source=Array.isArray(values)?values:[values];return [...new Set(source.flatMap(value=>String(value??'').replaceAll('\\r\\n','\n').replaceAll('\\n','\n').replaceAll('\\r','\n').split(/[\r\n,;]+/).map(x=>x.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'ru'))}
function load(){try{const raw=localStorage.getItem(STORAGE)||localStorage.getItem('okpt-scheduler-prototype-v6')||localStorage.getItem('okpt-scheduler-prototype-v5');if(!raw)return {...structuredClone(blank),replacementReviewItems:REPLACEMENT_REVIEW.map((x,i)=>({...x,id:'review-'+(i+1),status:'На проверке'}))};const saved=JSON.parse(raw);return {...structuredClone(blank),lessons:saved.lessons||[],substitutions:saved.substitutions||[],teacherProfiles:{...(blank.teacherProfiles||{}),...(saved.teacherProfiles||{})},replacementReviewItems:saved.replacementReviewItems||REPLACEMENT_REVIEW.map((x,i)=>({...x,id:'review-'+(i+1),status:'На проверке'})),scheduleDemands:saved.scheduleDemands||[],week13Reviews:saved.week13Reviews||{},teachers:normalizeNames(saved.teachers??blank.teachers),rooms:normalizeNames(saved.rooms??blank.rooms),groups:blank.groups,departments:blank.departments,groupDepartments:{...blank.groupDepartments,...saved.groupDepartments},groupCourses:blank.groupCourses,groupSpecialties:{...blank.groupSpecialties,...saved.groupSpecialties},groupCurricula:{...blank.groupCurricula,...saved.groupCurricula},specialties:blank.specialties,curricula:[...blank.curricula,...(saved.curricula||[]).filter(x=>!blank.curricula.some(y=>y.id===x.id))]}}catch{return structuredClone(blank)}}
function save(){localStorage.setItem(STORAGE,JSON.stringify(data));render()}
function id(){return crypto.randomUUID?.()||String(Date.now()+Math.random())}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dept(g){return data.groupDepartments?.[g]||'Не распределено'}
function course(g){return data.groupCourses?.[g]??(/^\d/.test(g)?Number(g[0]):'—')}
function groupSpecialty(g){return data.specialties?.find(x=>x.code===data.groupSpecialties?.[g])}
function groupPlan(g){return data.curricula.find(p=>p.id===data.groupCurricula?.[g])}
function subjectsFor(g){return groupPlan(g)?.subjects||data.subjects||[]}
function weekDate(i){const d=new Date(data.week+'T12:00:00');d.setDate(d.getDate()+i);return d}
function fmtDate(d){return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}
function groupBusy(a,b){return a.group===b.group&&(!a.subgroup||!b.subgroup||a.subgroup===b.subgroup)}
function conflicts(candidate,excludeId=null){
 const target=candidate.id?effectiveLesson(candidate):candidate;
 return data.lessons.filter(raw=>{
  if(raw.id===excludeId||raw.day!==target.day||raw.slot!==target.slot)return false;
  const x=effectiveLesson(raw);
  return groupBusy(target,x)||(target.teacher&&target.teacher===x.teacher)||(target.room&&target.room===x.room);
 }).map(raw=>{
  const x=effectiveLesson(raw);
  return {x,reason:groupBusy(target,x)?'Группа/подгруппа уже занята':target.teacher&&target.teacher===x.teacher?'Преподаватель уже занят':'Аудитория уже занята'};
 })
}
function teacherBusy(name,day,slot,excludeId=null){return data.lessons.map(effectiveLesson).find(x=>x.id!==excludeId&&x.teacher===name&&x.day===day&&x.slot===slot)||null}
function teacherProfile(name){return data.teacherProfiles?.[name]||{employment:'Не указан',availableDays:[],availablePairs:[],preferredDays:[],preferredPairs:[],unavailableSlots:[],note:''}}
function pairNumber(day,slot){const index=SLOTS[day]?.indexOf(slot)??-1;return index<0?0:Math.floor(index/2)+1}
function parseList(value){return String(value||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean)}
function teacherWarnings(item){
 if(!item.teacher)return [];
 const p=teacherProfile(item.teacher),warnings=[],day=item.day,pair=pairNumber(day,item.slot),key=day+':'+pair;
 if(p.availableDays.length&&!p.availableDays.includes(day))warnings.push('Преподаватель не указал этот день как доступный ('+day+').');
 if(p.availablePairs.length&&!p.availablePairs.includes(String(pair))&&!p.availablePairs.includes(key))warnings.push('Пара №'+pair+' не входит в указанные доступные пары преподавателя.');
 if(p.unavailableSlots.includes(key)||p.unavailableSlots.includes(day+':'+item.slot))warnings.push('Этот день/пара отмечены преподавателем как недоступные.');
 if(p.preferredDays.length&&!p.preferredDays.includes(day))warnings.push('День не входит в предпочтительные дни преподавателя.');
 if(p.preferredPairs.length&&!p.preferredPairs.includes(String(pair))&&!p.preferredPairs.includes(key))warnings.push('Пара не входит в предпочтительные интервалы преподавателя.');
 return warnings
}
function visibleGroups(){return data.groups.filter(g=>deptFilter==='Все отделения'||dept(g)===deptFilter)}
function render(){
 const root=document.querySelector('#app')
 const total=data.lessons.length,issues=data.lessons.reduce((n,x)=>n+(conflicts(x,x.id).length?1:0),0)
 root.innerHTML=`
 <div class="app-shell">
  <aside class="sidebar"><div class="brand"><div class="brand-mark">О</div><div><b>ОКПТ</b><small>Планировщик расписания</small></div></div>
   <div class="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
   <button type="button" class="side-link ${tab==='auto'?'active':''}" data-tab="auto" aria-label="Открыть автосоставление">✦ <span>Автосоставление</span></button>
   <button class="side-link ${tab==='week'?'active':''}" data-tab="week">▦ <span>Недельное расписание</span></button>
   <button class="side-link ${tab==='lists'?'active':''}" data-tab="lists">☷ <span>Справочники</span></button>
   <button class="side-link ${tab==='groupmap'?'active':''}" data-tab="groupmap">⇄ <span>Группы и учебные планы</span></button>
   <button class="side-link ${tab==='plans'?'active':''}" data-tab="plans">▤ <span>Справочник учебных планов</span></button>
   <button class="side-link ${tab==='replacements'?'active':''}" data-tab="replacements">↔ <span>Замены</span></button>
   <button class="side-link ${tab==='rules'?'active':''}" data-tab="rules">✓ <span>Контроль конфликтов</span></button>
   <button class="side-link ${tab==='workload'?'active':''}" data-tab="workload">▤ <span>Баланс нагрузки</span></button>
   <button class="side-link" data-tab="teachers">♙ <span>Преподаватели</span></button>
   <div class="sidebar-bottom demo-status"><i></i><div><b>Демонстрационный режим</b><small>Общие стартовые справочники из GitHub</small></div></div>
  </aside>
  <main class="main"><header class="topbar"><div><span>ОКПТ</span>　/　<b>${({auto:'Автосоставление',week:'Недельное расписание',lists:'Справочники',groupmap:'Группы и учебные планы',plans:'Справочник учебных планов',replacements:'Замены',rules:'Контроль расписания',workload:'Баланс нагрузки',teachers:'Преподаватели'})[tab]}</b></div><div class="top-right"><span class="year-chip">ДЕМО · 2026 / 2027</span><button class="btn light" id="reset-demo">↺ Сбросить демо</button><button class="btn gold" id="export">↓ Экспорт Excel</button></div></header>
   <section class="page"><div class="page-head"><div><p class="eyebrow">ДИСПЕТЧЕРСКАЯ · УЧЕБНЫЙ ГОД 2026/2027</p><h1>${({auto:'Автоматическое составление расписания',week:'Составление расписания на неделю',lists:'Справочники колледжа',groupmap:'Соответствие групп специальностям и учебным планам',plans:'Справочник учебных планов',replacements:'Замены в расписании',rules:'Контроль ограничений',workload:'Баланс учебной нагрузки',teachers:'Нагрузка и рабочее расписание преподавателей, доступность, свободные пары и замены.'})[tab]}</h1><p class="muted">${({auto:'Заявки на занятия и автоматическое распределение по дням и урокам.',week:'Занятия, группы, преподаватели и аудитории в единой недельной сетке.',lists:'Общие справочники колледжа с разделением групп по отделениям.',groupmap:'Здесь назначается специальность и автоматически связанный с ней учебный план каждой группы.',plans:'Перечень учебных планов и дисциплин из исходных PDF.',replacements:'Оформление замены без потери исходного занятия и истории изменений.',rules:'Проверка пересечений и ограничений по введённым занятиям.',workload:'Недельные лимиты групп и преподавателей, дневная нагрузка и остаток часов по дисциплинам.'})[tab]}</p><div class="demo-banner"><b>Прототип для демонстрации.</b> В репозитории доступны 59 учебных групп и 101 преподавательская запись, извлечённых из расписания 13-й недели. Аудитории добавлены по обозначениям, встречающимся в том же файле. Отделения и перечень специальностей внесены по предоставленной структуре; назначение специальности каждой группе сверяется с графиками. Изменения на этом этапе сохраняются в браузере, а не синхронизируются между сотрудниками.</div></div>${tab==='week'?'<button class="btn gold" id="add-lesson">＋ Добавить занятие</button>':''}</div>
   <div class="stats"><div class="stat"><small>Занятий на неделе</small><b>${total}</b></div><div class="stat"><small>Групп</small><b>${data.groups.length}</b></div><div class="stat"><small>Преподавателей</small><b>${data.teachers.length}</b></div><div class="stat"><small>Пересечений</small><b class="${issues?'red':'green'}">${issues}</b></div></div>
   ${tab==='auto'?autoView():tab==='week'?weekView():tab==='lists'?listsView():tab==='groupmap'?groupMapView():tab==='plans'?plansView():tab==='replacements'?replacementsView():tab==='workload'?workloadView():tab==='teachers'?teacherView():rulesView()}
   <footer>ОКПТ · Прототип планировщика · Исходные справочники: расписание 13-й недели 2026</footer></section></main></div>
 <div class="modal-backdrop" id="modal" hidden><section class="modal"><div class="modal-head"><div><p class="eyebrow">РАСПИСАНИЕ</p><h2 id="modal-title">Новое занятие</h2></div><button class="close" id="close">×</button></div><form id="lesson-form"><div class="form-grid">
 <label>Отделение<select name="department">${data.departments.filter(x=>x!=='Не распределено').map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
 <label>Учебная группа<select name="group" id="group-select" required></select></label>
 <label>Подгруппа<select name="subgroup"><option value="">Вся группа</option><option>1 подгруппа</option><option>2 подгруппа</option></select></label>
 <label>День недели<select name="day">${DAYS.map(x=>`<option>${x}</option>`).join('')}</select></label>
 <label>Урок / время<select name="slot" id="slot-select"></select></label>
 <label class="wide">Дисциплина<select name="subject" id="subject-select" required></select></label>
 <label>Преподаватель<select name="teacher" id="teacher-select"><option value="">— Не назначен —</option></select></label>
 <label>Аудитория<input name="room" list="room-options" placeholder="Номер / название"><datalist id="room-options">${data.rooms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
 <label class="wide">Примечание<input name="note" placeholder="Необязательно"></label></div><div id="form-alert" class="form-alert" hidden></div><div class="modal-actions"><button type="button" class="btn light" id="cancel">Отмена</button><button class="btn gold" type="submit">Сохранить занятие</button></div></form></section></div>
 <div class="modal-backdrop" id="sub-modal" hidden><section class="modal"><div class="modal-head"><div><p class="eyebrow">КАДРОВОЕ ИЗМЕНЕНИЕ</p><h2>Оформить замену</h2></div><button class="close" id="sub-close">×</button></div><form id="sub-form"><div class="form-grid"><label class="wide">Исходное занятие<select name="lesson" required>${data.lessons.map(x=>`<option value="${x.id}">${esc(x.day)} · ${esc(x.slot)} · ${esc(x.group)} · ${esc(x.subject)} · ${esc(x.teacher)}</option>`).join('')}</select></label><label>Новый преподаватель<input name="teacher" list="teacher-options"></label><label>Новая аудитория<input name="room" list="room-options"></label><label>Причина замены<input name="reason" required placeholder="Например, больничный"></label><label>Статус<select name="status"><option>На согласовании</option><option>Утверждена</option></select></label></div><div id="sub-alert" class="form-alert" hidden></div><div class="modal-actions"><button type="button" class="btn light" id="sub-cancel">Отмена</button><button class="btn gold" type="submit">Сохранить замену</button></div></form></section></div>`
 bind()
}

function week13ReviewView(){
 const imported=data.week13Reviews||{},count=WEEK13_ASSIGNMENTS.length,done=WEEK13_ASSIGNMENTS.filter(x=>imported[x.id]?.added).length;
 const rows=WEEK13_ASSIGNMENTS.map(x=>{
  const names=(x.teachers||'').split(' + ').map(v=>v.trim()).filter(Boolean),multi=names.length>1;
  const teacherOptions=data.teachers.map(t=>'<option value="'+esc(t)+'" '+(x.teachers===t?'selected':'')+'>'+esc(t)+'</option>').join('');
  const teacherCell=multi?'<div class="w13-split-teachers">'+names.map((n,i)=>'<span><b>'+(i+1)+' подгруппа:</b> '+esc(n)+'</span>').join('')+'</div>':'<select class="w13-teacher"><option value="">— Выбрать преподавателя —</option>'+teacherOptions+'</select><small>'+esc(x.teachers||'Преподаватель не распознан')+'</small>';
  const subj=x.subjectNormalized||x.subjectSource||'';
  return '<tr data-w13-row data-search="'+esc([x.group,x.subjectSource,x.subjectNormalized,x.teachers].join(' ').toLowerCase())+'" data-group="'+esc(x.group)+'"><td><input type="checkbox" class="w13-select" aria-label="Выбрать запись '+esc(x.id)+'" '+(imported[x.id]?.added?'disabled':'')+'><b>'+esc(x.group)+'</b><small>'+esc(x.exampleDay||'')+' · '+esc(x.exampleDate||'')+' · урок '+esc(x.exampleLesson||'')+'</small></td><td><small>'+esc(x.subjectSource||'—')+'</small><input class="w13-subject" value="'+esc(subj)+'" aria-label="Нормализованная дисциплина"></td><td>'+teacherCell+'</td><td>'+esc(x.subgroup?x.subgroup+' подгруппа':multi?'1 и 2 подгруппы':'Вся группа')+'</td><td>'+esc(x.occurrencesInWeek||'—')+'</td><td><span class="mapping-status '+(x.subjectNormalized?'is-confirmed':'is-pending')+'">'+(x.subjectNormalized?'Есть вариант':'Нужно уточнить')+'</span><small>'+esc(x.roomCandidate?'Ауд. кандидат: '+x.roomCandidate:'Аудитория не подтверждена')+'</small></td><td><button class="btn small '+(imported[x.id]?.added?'light':'gold')+'" data-w13-add="'+esc(x.id)+'" '+(imported[x.id]?.added?'disabled':'')+'>'+(imported[x.id]?.added?'Добавлено':'В заявку →')+'</button></td></tr>'
 }).join('');
 return '<div class="panel"><div class="panel-head"><div><h2>Проверка источника · расписание 13-й недели</h2><p class="muted">539 распознанных связок «группа — дисциплина — преподаватель». Это черновик распознавания, а не утверждённое расписание.</p></div><div class="review-toolbar"><span class="mapping-status is-pending">'+done+' / '+count+' перенесено</span><button type="button" class="btn light" id="w13-close-review">Свернуть проверку</button><button type="button" class="btn light" id="w13-select-all">Выделить все</button><button type="button" class="btn gold" id="w13-add-all">＋ Добавить всё выбранное</button></div></div><div class="auto-notice">Выдели нужные строки или нажми «Выделить все». «Добавить всё выбранное» перенесёт подтверждённые дисциплины. Если указано два преподавателя, система создаст две заявки: 1-я и 2-я подгруппы. Перед массовым переносом можно проверить и отредактировать строки ниже.</div><div class="auto-notice">Проверь дисциплину и преподавателя в каждой строке. Если указано два преподавателя, они автоматически закрепляются за 1-й и 2-й подгруппами соответственно. Кандидат аудитории не считается подтверждённым. Перенос создаёт только заявку на распределение, не занятие в расписании. Изменения сохраняются в этом браузере и не синхронизируются между компьютерами.</div><div class="form-grid"><label>Поиск по группе, дисциплине или преподавателю<input id="w13-search" placeholder="Например, 101-9 или Математика"></label><label>Группа<select id="w13-group"><option value="">Все группы</option>'+data.groups.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label><label>Состояние дисциплины<select id="w13-status"><option value="">Все записи</option><option value="known">Есть вариант дисциплины</option><option value="unknown">Требует уточнения</option></select></label></div><div class="table-scroll review-table-scroll"><table class="directory review-table"><thead><tr><th><input type="checkbox" id="w13-select-visible" aria-label="Выделить все видимые записи"> Группа / пример</th><th>Дисциплина: источник → вариант</th><th>Преподаватель</th><th>Подгруппа</th><th>Часов/нед.</th><th>Статус / аудитория</th><th>Действие</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="under-note">Количество часов взято из числа распознанных появлений в недельном источнике. Перед утверждением расписания его нужно сверить с учебным планом и оригинальным PDF.</p></div>'
}

function autoView(){
 const demands=data.scheduleDemands||[],ready=demands.filter(x=>x.group&&x.subject&&Number(x.hours)>0&&x.teacher),total=ready.reduce((n,x)=>n+Number(x.hours),0);
 const sourceReview=window.__w13ReviewOpen?week13ReviewView():'<div class="panel"><div class="panel-head"><div><h2>Проверка исходного расписания</h2><p class="muted">539 распознанных строк. Таблица загружается только по запросу, чтобы не задерживать открытие диспетчерской.</p></div><button class="btn light" id="w13-open-review">Открыть проверку источника</button></div></div>';
 return sourceReview+'<div class="panel"><div class="panel-head"><div><h2>Заявки на учебные занятия</h2><p class="muted">Внеси недельную потребность по группе и дисциплине. Для этой версии преподаватель указывается вручную.</p></div><span class="mapping-status is-pending">'+ready.length+' заявок · '+total+' ч</span></div>'+
 '<div class="form-grid"><label>Группа<select id="demand-group">'+data.groups.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label><label>Дисциплина<input id="demand-subject" placeholder="Название дисциплины"></label><label>Часов в неделю (2 часа = 1 пара)<input id="demand-hours" type="number" min="2" max="36" step="2" value="2"></label><label>Преподаватель<select id="demand-teacher"><option value="">— Выбрать —</option>'+data.teachers.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select></label><label>Подгруппа<select id="demand-subgroup"><option value="">Вся группа</option><option>1 подгруппа</option><option>2 подгруппа</option></select></label><label>Аудитория<input id="demand-room" list="demand-room-options" placeholder="Необязательно"><datalist id="demand-room-options">'+data.rooms.map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist></label><div><button class="btn gold" id="add-demand">＋ Добавить заявку</button></div></div></div>'+
 '<div class="panel"><div class="panel-head"><div><h2>Потребность для распределения</h2><p class="muted">Добавь заявки, затем запусти распределение.</p></div><button class="btn light" id="clear-demands" '+(demands.length?'':'disabled')+'>Очистить список</button></div><div class="table-scroll"><table class="directory"><thead><tr><th>Группа</th><th>Дисциплина</th><th>Часов в неделю</th><th>Преподаватель</th><th>Подгруппа</th><th>Аудитория</th><th></th></tr></thead><tbody>'+(demands.map((x,i)=>'<tr><td>'+esc(x.group)+'</td><td>'+esc(x.subject)+'</td><td>'+x.hours+'</td><td>'+esc(x.teacher||'')+'</td><td>'+esc(x.subgroup||'Вся группа')+'</td><td>'+esc(x.room||'Автовыбор не настроен')+'</td><td><button class="btn small light" data-delete-demand="'+i+'">Удалить</button></td></tr>').join('')||'<tr><td colspan="7">Заявок пока нет.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="panel"><div class="panel-head"><div><h2>Автоматическое распределение</h2><p class="muted">Проверяются пересечения группы, преподавателя и аудитории, доступность преподавателя, лимиты 8 часов в день и 36 часов в неделю.</p></div><button class="btn light" id="clear-generated" '+(data.lessons.some(x=>x.autoGenerated)?'':'disabled')+'>Удалить автосоставленные</button><button class="btn gold" id="run-auto" '+(ready.length?'':'disabled')+'>✦ Составить расписание</button></div><div class="auto-notice">Первая версия распределяет только явно внесённые заявки с уже назначенными преподавателями. Автоматический подбор преподавателя по квалификации, семестровая нагрузка, типы аудиторий и календарные графики ещё не подключены. Результат предварительный.</div><div id="auto-result" class="auto-result"></div></div>';
}
function weekView(){
 const mode=window.__okptScheduleMode||'group',selected=window.__okptEntityFilter||'Все';
 const allLabel=mode==='group'?'Все группы':mode==='teacher'?'Все преподаватели':'Все аудитории';
 const options=mode==='group'?visibleGroups():mode==='teacher'?data.teachers:data.rooms;
 const modeLabel=mode==='group'?'Группа':mode==='teacher'?'Преподаватель':'Аудитория';
 const matches=x=>(deptFilter==='Все отделения'||dept(x.group)===deptFilter)&&(selected==='Все'||(mode==='group'?x.group:mode==='teacher'?x.teacher:x.room)===selected);
 return `<div class="week-tools">
 <div class="week-switch"><button class="btn light" id="prev-week">‹</button><label>Неделя с <input type="date" id="week-date" value="${data.week}"></label><button class="btn light" id="next-week">›</button></div>
 <div class="week-switch"><label>Отделение <select id="dept-filter"><option>Все отделения</option>${data.departments.map(d=>`<option ${deptFilter===d?'selected':''}>${esc(d)}</option>`).join('')}</select></label>
 <label>Представление <select id="schedule-mode"><option value="group" ${mode==='group'?'selected':''}>По группам</option><option value="teacher" ${mode==='teacher'?'selected':''}>По преподавателям</option><option value="room" ${mode==='room'?'selected':''}>По аудиториям</option></select></label>
 <label>${modeLabel} <select id="entity-filter"><option value="Все">${allLabel}</option>${options.map(x=>`<option value="${esc(x)}" ${selected===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div></div>
 <div class="schedule-summary">${selected==='Все'?'Общий обзор: в ячейках показано количество занятий. Откройте список, чтобы просмотреть детали.':'Отображаются занятия выбранного объекта. Нажмите карточку, чтобы открыть её для редактирования.'}</div>
 <div class="schedule-wrap"><table class="schedule"><thead><tr><th class="time-col">Урок</th>${DAYS.map((d,i)=>`<th>${d}<small>${fmtDate(weekDate(i))}</small></th>`).join('')}</tr></thead><tbody>${Array.from({length:11},(_,row)=>`<tr><th class="time-col"><b>${row+1}</b></th>${DAYS.map(day=>{const slot=SLOTS[day][row];if(!slot)return '<td class="no-slot">—</td>';const entries=data.lessons.filter(x=>x.day===day&&x.slot===slot&&matches(x));if(selected==='Все'){return `<td class="slot-cell compact-slot">${entries.length?`<div class="slot-count"><b>${entries.length}</b><span>занятий</span></div><button class="slot-open" data-open-slot="${esc(day)}" data-open-time="${esc(slot)}">Открыть список</button>`:'<span class="empty-slot">Свободно</span>'}<button class="add-slot" data-add-day="${day}" data-add-slot="${slot}" title="Добавить занятие">＋</button></td>`}return `<td class="slot-cell">${entries.map(x=>`<article class="lesson-card ${conflicts(x,x.id).length?'has-conflict':''}" data-edit="${x.id}"><b>${esc(x.group)} ${x.subgroup?'· '+esc(x.subgroup):''}</b><span>${esc(x.subject)}</span><small>${esc(x.teacher||'Преподаватель не указан')} · ${esc(x.room||'ауд. не указана')}</small></article>`).join('')}<button class="add-slot" data-add-day="${day}" data-add-slot="${slot}">＋</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
 <div class="slot-details" id="slot-details" hidden><div class="slot-details-head"><div><b id="slot-details-title">Занятия</b><small id="slot-details-subtitle"></small></div><button class="btn light" id="close-slot-details">Закрыть</button></div><div id="slot-details-list"></div></div>
 <p class="under-note">Временные интервалы перенесены из файла «Расписание звонков». Понедельник имеет отдельный график, суббота — 8 уроков.</p>`
}
function getSlotEntries(day,slot){const mode=window.__okptScheduleMode||'group',selected=window.__okptEntityFilter||'Все';return data.lessons.filter(x=>x.day===day&&x.slot===slot&&(deptFilter==='Все отделения'||dept(x.group)===deptFilter)&&(selected==='Все'||(mode==='group'?x.group:mode==='teacher'?x.teacher:x.room)===selected))}
function listsView(){
 return `<div class="panel"><h2>Группы колледжа по отделениям</h2><p class="muted">Отделения распределены по графикам учебного процесса. Специальности и учебные планы назначаются в разделе «Группы и учебные планы».</p><div class="table-scroll"><table class="directory"><thead><tr><th>Группа</th><th>Курс</th><th>Отделение</th><th>Специальность</th><th>Учебный план</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td><b>${esc(g)}</b></td><td>${esc(course(g))}</td><td><select data-group-dept="${esc(g)}"><option value="Не распределено">Не распределено</option>${data.departments.filter(d=>d!=='Не распределено').map(d=>`<option ${dept(g)===d?'selected':''}>${esc(d)}</option>`).join('')}</select></td><td>${esc(groupSpecialty(g)?.name||'Не назначена')}</td><td>${esc(groupPlan(g)?.name||'Не назначен')}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="panel"><h2>Специальности и профессии колледжа</h2><div class="table-scroll"><table class="directory"><thead><tr><th>Отделение</th><th>Код</th><th>Специальность / профессия</th><th>Тип</th></tr></thead><tbody>${(data.specialties||[]).map(x=>`<tr><td>${esc(x.department)}</td><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${esc(x.kind)}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="panel"><div class="panel-head"><div><h2>Преподаватели и условия расписания</h2><p class="muted">Кадровый статус и ограничения пока не заполнены. Внеси сведения по каждому преподавателю: допустимые и предпочтительные дни/пары, а также недоступные интервалы.</p></div><button class="btn gold" id="save-teacher-profiles">Сохранить условия</button></div>
 <div class="teacher-guidance"><b>Как заполнять:</b> дни — полными названиями через запятую; пары — номера через запятую; недоступные интервалы — «Понедельник:2, Пятница:4». Пустое поле означает, что ограничение пока неизвестно, а не что преподаватель свободен всегда. Предпочтения дают предупреждение, но не запрещают занятие.</div>
 <div class="table-scroll"><table class="directory teacher-profile-table"><thead><tr><th>Преподаватель</th><th>Статус</th><th>Доступные дни</th><th>Доступные пары</th><th>Предпочтительные дни</th><th>Предпочтительные пары</th><th>Недоступные интервалы</th><th>Примечание</th></tr></thead><tbody>${data.teachers.map(name=>{const p=teacherProfile(name);return `<tr data-teacher-row="${esc(name)}"><td><b>${esc(name)}</b></td><td><select data-tf="employment"><option ${p.employment==='Не указан'?'selected':''}>Не указан</option><option ${p.employment==='Штатный'?'selected':''}>Штатный</option><option ${p.employment==='Внешний совместитель'?'selected':''}>Внешний совместитель</option><option ${p.employment==='Внутренний совместитель'?'selected':''}>Внутренний совместитель</option><option ${p.employment==='Почасовик'?'selected':''}>Почасовик</option></select></td><td><input data-tf="availableDays" value="${esc(p.availableDays.join(', '))}" placeholder="Понедельник, Вторник"></td><td><input data-tf="availablePairs" value="${esc(p.availablePairs.join(', '))}" placeholder="1, 2, 3…"></td><td><input data-tf="preferredDays" value="${esc(p.preferredDays.join(', '))}" placeholder="Понедельник, Среда"></td><td><input data-tf="preferredPairs" value="${esc(p.preferredPairs.join(', '))}" placeholder="1, 2, 3…"></td><td><input data-tf="unavailableSlots" value="${esc(p.unavailableSlots.join(', '))}" placeholder="Понедельник:2"></td><td><input data-tf="note" value="${esc(p.note)}" placeholder="Комментарий"></td></tr>`}).join('')}</tbody></table></div></div>
 <div class="lists-grid"><section class="panel"><h2>Список преподавателей</h2><p class="muted">99 записей из расписания 13-й недели. Это не подтверждённый кадровый реестр.</p><textarea id="list-teachers">${esc(data.teachers.join('\n'))}</textarea><button class="btn gold save-list" data-list="teachers">Сохранить список</button><small>${data.teachers.length} записей</small></section><section class="panel"><h2>Аудитории и залы</h2><p class="muted">Обозначения из расписания; типы и вместимость уточняются.</p><textarea id="list-rooms">${esc(data.rooms.join('\n'))}</textarea><button class="btn gold save-list" data-list="rooms">Сохранить список</button><small>${data.rooms.length} записей</small></section></div>`
}
function groupMapView(){
 const assigned=data.groups.filter(g=>data.groupSpecialties?.[g]&&data.groupCurricula?.[g]).length;
 const deptAssigned=data.groups.filter(g=>dept(g)!=='Не распределено').length;
 const byDept=data.departments.filter(x=>x!=='Не распределено').map(d=>({d,n:data.groups.filter(g=>dept(g)===d).length,assigned:data.groups.filter(g=>dept(g)===d&&data.groupSpecialties?.[g]).length}));
 return `<div class="stats mapping-stats"><div class="stat"><small>Всего групп</small><b>${data.groups.length}</b></div><div class="stat"><small>Отделение указано</small><b>${deptAssigned}</b></div><div class="stat"><small>Специальность подтверждена</small><b>${assigned}</b></div><div class="stat"><small>Ожидают сопоставления</small><b>${data.groups.length-assigned}</b></div></div>
 <div class="panel mapping-intro"><h2>Сопоставление учебных групп</h2><p>Это основной экран для привязки группы к специальности и учебному плану. Сейчас специальности групп не проставлены автоматически: кроме известной информации о педагогическом отделении и специальности «Реклама», остальные соответствия нужно подтвердить по документам колледжа.</p><div class="mapping-legend"><span><i class="legend-dot confirmed"></i> Назначено</span><span><i class="legend-dot pending"></i> Требует подтверждения</span></div></div>
 <div class="panel"><h2>Сводка по отделениям</h2><div class="mapping-dept-grid">${byDept.map(x=>`<div class="mapping-dept"><b>${esc(x.d)}</b><strong>${x.n}</strong><small>${x.assigned} из ${x.n} групп со специальностью</small></div>`).join('')}</div></div>
 <div class="panel"><div class="panel-head"><div><h2>Группы → специальности → учебные планы</h2><p class="muted">Выбери специальность только там, где соответствие известно. Учебный план будет назначен автоматически.</p></div><div class="mapping-filters"><select id="map-dept-filter"><option value="Все отделения">Все отделения</option>${data.departments.filter(x=>x!=='Не распределено').map(d=>`<option>${esc(d)}</option>`).join('')}</select><select id="map-status-filter"><option value="all">Все группы</option><option value="pending">Без специальности</option><option value="assigned">Со специальностью</option></select></div></div>
 <div class="table-scroll"><table class="directory mapping-table"><thead><tr><th>Группа</th><th>Курс</th><th>Отделение</th><th>Специальность / профессия</th><th>Учебный план</th><th>Статус</th></tr></thead><tbody>${data.groups.map(g=>{const sp=groupSpecialty(g),pl=groupPlan(g);return `<tr data-map-row="${esc(g)}" data-map-dept="${esc(dept(g))}" data-map-status="${sp?'assigned':'pending'}"><td><b>${esc(g)}</b></td><td>${esc(course(g))}</td><td><select data-group-dept="${esc(g)}">${data.departments.map(d=>`<option value="${esc(d)}" ${dept(g)===d?'selected':''}>${esc(d)}</option>`).join('')}</select></td><td><select data-group-specialty="${esc(g)}"><option value="">— Не установлена —</option>${(data.specialties||[]).map(x=>`<option value="${esc(x.code)}" ${data.groupSpecialties?.[g]===x.code?'selected':''}>${esc(x.code+' · '+x.name)}</option>`).join('')}</select></td><td class="map-plan">${pl?esc(pl.name):'<span class="muted">Не назначен</span>'}</td><td><span class="mapping-status ${sp?'is-confirmed':'is-pending'}">${sp?'Назначено':'Нужно уточнить'}</span></td></tr>`}).join('')}</tbody></table></div></div>`
}
function filterMapRows(){const d=document.querySelector('#map-dept-filter').value,st=document.querySelector('#map-status-filter').value;document.querySelectorAll('[data-map-row]').forEach(r=>{r.hidden=(d!=='Все отделения'&&r.dataset.mapDept!==d)||(st!=='all'&&r.dataset.mapStatus!==st)})}
function plansView(){
 const assignedCount=data.groups.filter(g=>data.groupCurricula?.[g]).length;
 return `<div class="panel"><div class="panel-head"><div><h2>Учебные планы и закреплённые группы</h2><p class="muted">Открой нужный учебный план и отметь группы, которые по нему обучаются. Выбор сохраняется автоматически. Каждая группа может быть закреплена только за одним планом.</p></div><div class="stat"><small>Групп с назначенным планом</small><b>${assignedCount} / ${data.groups.length}</b></div></div>
 <div class="plan-assignment-list">${data.curricula.map(p=>{const linkedSpecialties=data.specialties.filter(x=>x.curriculumId===p.id);const depts=[...new Set(linkedSpecialties.map(x=>x.department).filter(Boolean))];const groups=data.groups.filter(g=>!depts.length||depts.includes(dept(g))||data.groupCurricula?.[g]===p.id);const count=data.groups.filter(g=>data.groupCurricula?.[g]===p.id).length;return `<details class="plan-assignment"><summary><span><b>${esc(p.name)}</b><small>${p.subjects.length} дисциплин · ${count} групп</small></span><span class="mapping-status ${count?'is-confirmed':'is-pending'}">${count?'Группы назначены':'Нет групп'}</span></summary><div class="plan-assignment-body"><p class="muted">${depts.length?'Группы соответствующих отделений.':'Отделение для этого плана отдельно не определено — показаны все группы.'} Отметь нужные группы:</p><div class="plan-group-checks">${groups.map(g=>`<label class="plan-group-check"><input type="checkbox" data-plan-group="${esc(g)}" data-plan-id="${esc(p.id)}" ${data.groupCurricula?.[g]===p.id?'checked':''}><span><b>${esc(g)}</b><small>${esc(dept(g))}</small></span></label>`).join('')||'<span class="muted">Нет групп для отображения.</span>'}</div></div></details>`}).join('')}</div></div>
 <div class="panel"><h2>Добавить дополнительный план</h2><div class="form-grid plan-create"><label>Название плана<input id="plan-name" placeholder="Название"></label><label>Дисциплины (по одной в строке)<textarea id="plan-subjects" placeholder="Математика\\nИнформатика\\nИстория"></textarea></label><button class="btn gold" id="create-plan">＋ Добавить дополнительный план</button></div></div>`
}
function replacementsView(){
 const items=data.replacementReviewItems||[],pending=items.filter(x=>x.status==='На проверке').length,checked=items.filter(x=>x.status==='Проверено').length,rejected=items.filter(x=>x.status==='Отклонено').length;
 return `<div class="panel"><div class="panel-head"><div><h2>Журнал замен</h2><p class="muted">Исходное занятие сохраняется. Замена фиксируется отдельно и может быть согласована.</p></div><button class="btn gold" id="add-substitution" ${data.lessons.length?'':'disabled'}>＋ Оформить замену</button></div>${data.substitutions.length?data.substitutions.map(s=>{const l=data.lessons.find(x=>x.id===s.lessonId);return `<div class="substitution-row"><b>${l?esc(l.group+' · '+l.day+' · '+l.slot+' · '+l.subject):'Исходное занятие удалено'}</b><span>${esc(l?.teacher||'Преподаватель не указан')} → ${esc(s.teacher||l?.teacher||'без изменения')}</span><span>Аудитория: ${esc(s.room||l?.room||'без изменения')} · ${esc(s.reason)}</span><em>${esc(s.status)}</em></div>`}).join(''):'<div class="success-box">Ручные замены ещё не оформлялись. Для оформления занятия сначала должны быть загружены в расписание.</div>'}</div>
 <div class="panel"><div class="panel-head"><div><h2>Проверка распознанных листов замен</h2><p class="muted">90 строк из двух PDF. Проверка распознавания не меняет расписание автоматически.</p></div><div class="review-toolbar"><span class="mapping-status is-pending">${pending} ожидают проверки</span><button class="btn small gold" id="review-approve-all" ${pending?'':'disabled'}>Подтвердить все (${pending})</button><button class="btn small light" id="review-reject-all" ${pending?'':'disabled'}>Отклонить все (${pending})</button></div></div>
 <div class="rule-metrics"><b>${items.length}</b><span>строк распознано</span><b>${checked}</b><span>проверено</span><b>${rejected}</b><span>отклонено</span></div>
 <p class="muted">Сверьте дату, группу, номер урока, исходную запись и текст из листа замены. Если указано «НЕТ СОВПАДЕНИЯ», запись требует отдельной проверки как возможное дополнительное занятие. Подтверждение здесь фиксирует только корректность распознанной строки — оно не применяет замену к календарю.</p>
 <div class="table-scroll"><table class="directory"><thead><tr><th>Дата / урок</th><th>Группа</th><th>Исходная запись</th><th>Распознано из листа</th><th>Источник / статус</th><th>Проверка</th></tr></thead><tbody>${items.map(x=>`<tr><td><b>${esc(x.date)}</b><br>Урок ${x.lesson}</td><td><b>${esc(x.group)}</b></td><td>${esc(x.baseline_text||'—')}</td><td>${esc(x.replacement_cell_text||'—')}</td><td><small>${esc(x.source_pdf)}</small><br><span class="mapping-status ${x.status==='Проверено'?'is-confirmed':x.status==='Отклонено'?'is-pending':''}">${esc(x.status||'На проверке')}</span></td><td>${x.status==='На проверке'?`<button class="btn small gold" data-review-approve="${x.id}">Подтвердить</button> <button class="btn small light" data-review-reject="${x.id}">Отклонить</button>`: `<button class="btn small light" data-review-reset="${x.id}">Вернуть</button>`}</td></tr>`).join('')}</tbody></table></div></div>`
}

function generateAutoSchedule(){
 data.lessons=data.lessons.filter(x=>!x.autoGenerated&&!String(x.note||'').startsWith('Автоматическое распределение'));
 const demands=(data.scheduleDemands||[]).filter(x=>x.group&&x.subject&&x.teacher&&Number(x.hours)>0),added=[],unplaced=[];
 const classMap=new Map();
 demands.forEach((d,i)=>{
  // Одна дисциплина одной группы — единый блок потребности.
  // Кабинет, преподаватель и подгруппа не должны разрывать его на разные пары.
  const subjectKey=String(d.subject||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
  const key=[d.group,subjectKey].join('|');
  if(!classMap.has(key))classMap.set(key,[]);
  classMap.get(key).push({...d,_order:i});
 });
 const blocks=[];
 classMap.forEach(items=>{
  const hourValues=[...new Set(items.map(x=>Number(x.hours)||0))];
  if(hourValues.length!==1){
   unplaced.push({group:items[0].group,subject:items[0].subject,unit:'—',items,reason:'У одной дисциплины указано разное количество часов в заявках подгрупп. Укажи одинаковую недельную нагрузку для всех подгрупп.'});
   return;
  }
  if(items.length>2){
   unplaced.push({group:items[0].group,subject:items[0].subject,unit:'—',items,reason:'Для одной дисциплины найдено более двух заявок. Проверь, что подгруппы не продублированы.'});
   return;
  }
  // Две заявки одной дисциплины относятся к разным подгруппам.
  // Если подгруппы не указаны, назначаем их по порядку строк.
  if(items.length===2){
   items.forEach((item,index)=>{if(!item.subgroup||item.subgroup==='Вся группа')item.subgroup=(index===0?'1 подгруппа':'2 подгруппа')});
  }
  if(items.length===2&&items[0].subgroup===items[1].subgroup){
   unplaced.push({group:items[0].group,subject:items[0].subject,unit:'—',items,reason:'Обе заявки назначены одной и той же подгруппе. Укажи для них разные подгруппы.'});
   return;
  }
  const hours=hourValues[0];
  if(hours%2!==0){unplaced.push({group:items[0].group,subject:items[0].subject,unit:'—',items,reason:'Недельная нагрузка должна быть чётной: одна пара = ровно 2 академических часа. Укажи 2, 4, 6 часов и т. д.'});return}
  const pairs=hours/2;
  // Разные преподаватели ведут подгруппы одновременно.
  // Один преподаватель ведёт подгруппы последовательно: каждая получает собственные пары.
  const sameTeacher=items.length===2&&items[0].teacher===items[1].teacher;
  const schedulingUnits=sameTeacher?items.map(item=>[item]):[items];
  schedulingUnits.forEach(unitItems=>{for(let pair=0;pair<pairs;pair++)blocks.push({items:unitItems,pair:pair+1,group:items[0].group,subject:items[0].subject,hours})});
 });
 blocks.sort((a,b)=>b.hours-a.hours);
 const slots=DAYS.flatMap(day=>SLOTS[day].map((slot,index)=>({day,slot,index})));
 const allowed=(d,t)=>{const p=teacherProfile(d.teacher),pair=String(Math.floor(t.index/2)+1),key=t.day+':'+pair;if(p.availableDays.length&&!p.availableDays.includes(t.day))return false;if(p.availablePairs.length&&!p.availablePairs.includes(pair)&&!p.availablePairs.includes(key))return false;if(p.unavailableSlots.includes(key)||p.unavailableSlots.includes(t.day+':'+t.slot))return false;return true};
 const score=(block,t)=>{const gd=data.lessons.filter(x=>x.group===block.group&&x.day===t.day),teacherLoad=block.items.reduce((n,d)=>n+data.lessons.filter(x=>x.teacher===d.teacher&&x.day===t.day).length,0);let n=gd.length*8+teacherLoad*2;const ix=gd.map(x=>SLOTS[t.day].indexOf(x.slot)).filter(x=>x>=0);if(ix.length)n+=Math.min(Math.abs(t.index-Math.min(...ix)),Math.abs(t.index-Math.max(...ix)))*2;block.items.forEach(d=>{const p=teacherProfile(d.teacher);if(p.preferredDays.length&&!p.preferredDays.includes(t.day))n+=10;if(p.preferredPairs.length&&!p.preferredPairs.includes(String(Math.floor(t.index/2)+1))&&!p.preferredPairs.includes(t.day+':'+(Math.floor(t.index/2)+1)))n+=4});return n+t.index*.05};
 for(const block of blocks){
  const pairStarts=slots.filter(t=>t.index%2===0&&t.index+1<SLOTS[t.day].length);
  const candidates=pairStarts.filter(start=>{
   const second={day:start.day,slot:SLOTS[start.day][start.index+1],index:start.index+1};
   if(groupWeekHours(block.group)+2>36||groupDayHours(block.group,start.day)+2>8)return false;
   for(const d of block.items){
    if(teacherWeekHours(d.teacher)+2>36)return false;
    if(!allowed(d,start)||!allowed(d,second))return false;
    for(const t of [start,second]){
     if(data.lessons.some(x=>x.day===t.day&&x.slot===t.slot&&(groupBusy({group:d.group,subgroup:d.subgroup},x)||x.teacher===d.teacher||(d.room&&x.room===d.room))))return false;
    }
   }
   return true;
  }).sort((a,b)=>score(block,a)-score(block,b));
  const start=candidates[0];
  if(!start){unplaced.push({group:block.group,subject:block.subject,unit:block.pair,items:block.items,reason:'Не найдена свободная пара из двух последовательных уроков для всех подгрупп'});continue}
  [0,1].forEach(offset=>{
   const t={day:start.day,slot:SLOTS[start.day][start.index+offset]};
   block.items.forEach(d=>{
    const lesson={id:id(),group:d.group,subgroup:d.subgroup||'',day:t.day,slot:t.slot,subject:d.subject,teacher:d.teacher,room:d.room||'',note:'Автоматическое распределение · пара '+block.pair,autoGenerated:true,pairId:block.group+'|'+block.subject+'|'+block.pair+'|'+start.day+'|'+start.index};
    data.lessons.push(lesson);added.push(lesson);
   });
  });
 }
 return {added,unplaced};
}
function groupWeekHours(group,excludeId=null){
 return new Set(data.lessons.filter(x=>x.id!==excludeId&&x.group===group).map(x=>x.day+'|'+x.slot)).size
}
function groupDayHours(group,day,excludeId=null){
 return new Set(data.lessons.filter(x=>x.id!==excludeId&&x.group===group&&x.day===day).map(x=>x.slot)).size
}
function teacherWeekHours(name,excludeId=null){
 return data.lessons.filter(x=>x.id!==excludeId&&x.teacher===name).length
}
function loadViolations(item,excludeId=null){
 const out=[];
 if(item.group){
  const week=groupWeekHours(item.group,excludeId),day=groupDayHours(item.group,item.day,excludeId);
  const alreadyDay=data.lessons.some(x=>x.id!==excludeId&&x.group===item.group&&x.day===item.day&&x.slot===item.slot);
  if(!alreadyDay&&week+1>36)out.push('У группы '+item.group+' будет '+(week+1)+' академических часов за неделю (лимит 36).');
  if(!alreadyDay&&day+1>8)out.push('У группы '+item.group+' будет '+(day+1)+' академических часов за день (лимит 8 — не более 4 пар).');
 }
 if(item.teacher){
  const hours=teacherWeekHours(item.teacher,excludeId);
  if(hours+1>36)out.push('У преподавателя '+item.teacher+' будет '+(hours+1)+' академических часов за неделю (лимит 36).');
 }
 return out
}
function effectiveLesson(lesson){
 const replacement=(data.substitutions||[]).filter(x=>x.lessonId===lesson.id&&x.status==='Утверждена').slice(-1)[0];
 return replacement?{...lesson,teacher:replacement.teacher||lesson.teacher,room:replacement.room||lesson.room,_replacement:replacement}:lesson;
}
function teacherView(){
 const selected=window.__okptTeacherFilter||data.teachers[0]||'';
 const p=teacherProfile(selected),planned=data.lessons.filter(x=>x.teacher===selected);
 const demands=(data.scheduleDemands||[]).filter(x=>x.teacher===selected);
 const approved=(data.substitutions||[]).filter(x=>x.status==='Утверждена');
 const replacedOut=approved.filter(x=>{const l=data.lessons.find(y=>y.id===x.lessonId);return l?.teacher===selected&&(x.teacher||l.teacher)!==selected});
 const replacedIn=approved.filter(x=>x.teacher===selected&&data.lessons.some(l=>l.id===x.lessonId&&l.teacher!==selected));
 const actual=data.lessons.map(effectiveLesson).filter(x=>x.teacher===selected);
 const plannedHours=demands.length?demands.reduce((n,x)=>n+Number(x.hours||0),0):planned.length,actualHours=actual.length;
 const subjects=[...new Set([...demands.map(x=>x.subject),...planned.map(x=>x.subject),...actual.map(x=>x.subject)])];
 const groups=[...new Set([...demands.map(x=>x.group),...planned.map(x=>x.group),...actual.map(x=>x.group)])];
 const occupancy=new Map();actual.forEach(x=>occupancy.set(x.day+'|'+x.slot,x));
 const availabilityKnown=p.availableDays.length>0||p.availablePairs.length>0||p.unavailableSlots.length>0;
 const free=[];
 DAYS.forEach(day=>{for(let i=0;i+1<SLOTS[day].length;i+=2){
  const pair=i/2+1,key=day+':'+pair,slots=[SLOTS[day][i],SLOTS[day][i+1]];
  const allowed=(!p.availableDays.length||p.availableDays.includes(day))&&(!p.availablePairs.length||p.availablePairs.includes(String(pair))||p.availablePairs.includes(key))&&!p.unavailableSlots.includes(key)&&!p.unavailableSlots.includes(day+':'+slots[0])&&!p.unavailableSlots.includes(day+':'+slots[1]);
  if(allowed&&!slots.some(slot=>occupancy.has(day+'|'+slot)))free.push(day+' · пара '+pair+' ('+slots.join(' / ')+')');
 }});
 const rows=actual.map(x=>'<tr><td>'+esc(x.day)+'</td><td>'+esc(x.slot)+'</td><td>'+esc(x.group)+(x.subgroup?' · '+esc(x.subgroup):'')+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.room||'—')+'</td><td>'+(x._replacement?'<span class="mapping-status is-pending">По замене</span>':'<span class="mapping-status is-confirmed">По расписанию</span>')+'</td></tr>').join('');
 const history=[...replacedIn.map(x=>({x,kind:'Заменял другого преподавателя'})),...replacedOut.map(x=>({x,kind:'Его занятие заменил другой преподаватель'}))].map(({x,kind})=>{const l=data.lessons.find(y=>y.id===x.lessonId);return '<tr><td>'+esc(l?.day||'—')+'</td><td>'+esc(l?.slot||'—')+'</td><td>'+esc(l?.group||'—')+'</td><td>'+esc(l?.subject||'—')+'</td><td>'+esc(kind)+'</td><td>'+esc(l?.teacher||'—')+' → '+esc(x.teacher||l?.teacher||'—')+'</td><td>'+esc(x.reason||'—')+'</td></tr>'}).join('');
 return '<div class="panel"><div class="panel-head"><div><h2>Рабочее место преподавателя</h2><p class="muted">Плановая и фактическая нагрузка, занятость, свободные интервалы и история замен.</p></div><label class="teacher-pick">Преподаватель<select id="teacher-workspace-select">'+data.teachers.map(t=>'<option '+(t===selected?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label></div></div>'+
 '<div class="stats"><div class="stat"><small>Плановая нагрузка</small><b>'+plannedHours+' ч</b></div><div class="stat"><small>Фактическая нагрузка</small><b>'+actualHours+' ч</b></div><div class="stat"><small>Заменял коллег</small><b>'+replacedIn.length+' записей</b></div><div class="stat"><small>Его занятия заменяли</small><b>'+replacedOut.length+' записей</b></div></div>'+
 '<div class="panel"><h2>Дисциплины и группы</h2><div class="teacher-facts"><div><b>Дисциплины</b><p>'+(subjects.length?subjects.map(esc).join(' · '):'Нет назначенных дисциплин')+'</p></div><div><b>Группы</b><p>'+(groups.length?groups.map(esc).join(' · '):'Нет назначенных групп')+'</p></div></div></div>'+
 '<div class="panel"><h2>Доступность и свободные пары</h2><p class="muted">Свободными считаются только интервалы, которые явно разрешены в профиле преподавателя и не заняты фактическим занятием. Неуказанная доступность не трактуется как свободное время.</p>'+(availabilityKnown?'<div class="rule-metrics"><b>'+free.length+'</b><span>свободных пар по заданным ограничениям</span></div>'+(free.length?'<div class="free-slot-list">'+free.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'<div class="soft-warning">Свободных подтверждённых пар не найдено.</div>'):'<div class="soft-warning">Доступные дни и пары не заполнены. Сначала укажи их в разделе «Справочники → Преподаватели и условия расписания».</div>')+'</div>'+
 '<div class="panel"><h2>Фактическое расписание преподавателя</h2><div class="table-scroll"><table class="directory"><thead><tr><th>День</th><th>Урок / время</th><th>Группа</th><th>Дисциплина</th><th>Аудитория</th><th>Основание</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Занятий пока нет.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="panel"><h2>История замен</h2><p class="muted">Учитываются оба направления. В фактической нагрузке учитываются только утверждённые замены.</p><div class="table-scroll"><table class="directory"><thead><tr><th>День</th><th>Урок</th><th>Группа</th><th>Дисциплина</th><th>Роль</th><th>Преподаватели</th><th>Причина</th></tr></thead><tbody>'+(history||'<tr><td colspan="7">Замен пока нет.</td></tr>')+'</tbody></table></div></div>';
}
function workloadView(){
 const groupRows=data.groups.map(g=>{const hours=groupWeekHours(g);const maxDay=Math.max(0,...DAYS.map(d=>groupDayHours(g,d)));return {g,hours,maxDay}});
 const teacherRows=data.teachers.map(t=>({t,hours:teacherWeekHours(t)})).filter(x=>x.hours>0).sort((a,b)=>b.hours-a.hours);
 const overGroups=groupRows.filter(x=>x.hours>36||x.maxDay>8),overTeachers=teacherRows.filter(x=>x.hours>36);
 return `<div class="stats"><div class="stat"><small>Групп с превышением</small><b class="${overGroups.length?'red':'green'}">${overGroups.length}</b></div><div class="stat"><small>Преподавателей с превышением</small><b class="${overTeachers.length?'red':'green'}">${overTeachers.length}</b></div><div class="stat"><small>Максимум группы за неделю</small><b>36 ч</b></div><div class="stat"><small>Максимум группы за день</small><b>8 ч</b></div></div>
 <div class="panel"><h2>Недельная нагрузка групп</h2><p class="muted">Считаются уникальные временные интервалы группы: параллельные занятия подгрупп в один и тот же час не удваивают нагрузку студентов. Один урок = один академический час.</p><div class="table-scroll"><table class="directory"><thead><tr><th>Группа</th><th>Учебный план</th><th>Часов за неделю</th><th>Максимум за день</th><th>Контроль</th></tr></thead><tbody>${groupRows.map(x=>`<tr><td><b>${esc(x.g)}</b></td><td>${esc(groupPlan(x.g)?.name||'Не назначен')}</td><td>${x.hours} / 36</td><td>${x.maxDay} / 8</td><td>${x.hours>36||x.maxDay>8?'<span class="mapping-status is-pending">Превышение</span>':'<span class="mapping-status is-confirmed">В пределах лимита</span>'}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="panel"><h2>Недельная нагрузка преподавателей</h2><p class="muted">Сумма назначенных академических часов по всем группам. Нагрузка по подгруппам считается отдельно для преподавателя.</p><div class="table-scroll"><table class="directory"><thead><tr><th>Преподаватель</th><th>Часов за неделю</th><th>Контроль</th></tr></thead><tbody>${teacherRows.map(x=>`<tr><td><b>${esc(x.t)}</b></td><td>${x.hours} / 36</td><td>${x.hours>36?'<span class="mapping-status is-pending">Превышение</span>':'<span class="mapping-status is-confirmed">В пределах лимита</span>'}</td></tr>`).join('')||'<tr><td colspan="3">Занятия пока не назначены.</td></tr>'}</tbody></table></div></div>
 <div class="panel"><h2>Семестровая нагрузка по дисциплинам</h2><p class="muted">В документах есть разбивка аудиторных часов по семестрам, но её нужно перенести в машиночитаемые значения отдельно от общего объёма часов, самостоятельной работы, практики и аттестации. Пока точные семестровые значения не импортированы, система не будет выдавать фиктивный недобор или автоматически распределять часы.</p><div class="success-box">Следующий этап: загрузка проверенных значений «аудиторные часы по семестрам» из каждого учебного плана и привязка календарных недель по графику соответствующего отделения.</div></div>`
}
function rulesView(){
 const issues=[];for(const l of data.lessons)for(const c of conflicts(l,l.id))if(l.id<c.x.id)issues.push({l,reason:c.reason});
 const warnings=data.lessons.flatMap(l=>teacherWarnings(l).map(reason=>({l,reason})));
 const profiles=Object.values(data.teacherProfiles||{}).filter(p=>p.employment&&p.employment!=='Не указан').length;
 return `<div class="panel"><h2>Жёсткие пересечения</h2><p class="muted">Одновременная занятость преподавателя, аудитории и группы. Такие занятия не сохраняются.</p>${issues.length?issues.map(i=>`<div class="issue"><b>${esc(i.l.day)} · ${esc(i.l.slot)}</b> — ${esc(i.l.group)} / ${esc(i.l.subject)}: ${esc(i.reason)}</div>`).join(''):'<div class="success-box">Среди введённых занятий жёстких пересечений не обнаружено.</div>'}</div>
 <div class="panel"><h2>Предупреждения по условиям преподавателей</h2><p class="muted">Проверяются доступность и предпочтения по дням и парам. Предупреждение не блокирует расписание автоматически: диспетчер может подтвердить сохранение.</p><div class="rule-metrics"><b>${warnings.length}</b><span>предупреждений по занятиям</span><b>${profiles}</b><span>преподавателей с указанным кадровым статусом</span></div>${warnings.length?warnings.map(w=>`<div class="soft-warning"><b>${esc(w.l.teacher)}</b> · ${esc(w.l.group)} · ${esc(w.l.day)} · ${esc(w.l.slot)}<p>${esc(w.reason)}</p></div>`).join(''):'<div class="success-box">Нет предупреждений. Если условия преподавателей ещё не заполнены, это не означает, что их доступность подтверждена.</div>'}</div>
 <div class="panel"><h2>Правила контроля</h2><ul class="rule-list"><li>Один преподаватель не может вести две пары одновременно в разных группах.</li><li>Одна аудитория не может быть назначена двум занятиям в один временной интервал.</li><li>Группа не может иметь параллельные занятия, если одно из них назначено всей группе.</li><li>Доступные дни и пары ограничивают назначение; выход за них вызывает предупреждение.</li><li>Предпочтительные дни и пары используются как мягкие ограничения.</li><li>Пустые поля не трактуются как подтверждение полной доступности.</li></ul></div>
 <div class="panel"><h2>Что подключим после получения данных</h2><p class="muted">Нормативную нагрузку, количество часов по договору, индивидуальные заявки и фактические рабочие интервалы преподавателей. Кадровый статус сам по себе не будет автоматически определять доступность — для этого нужны конкретные условия каждого сотрудника.</p></div>`
}
function fillGroups(department,selected=''){const el=document.querySelector('#group-select');const groups=data.groups.filter(g=>dept(g)===department);el.innerHTML=groups.length?groups.map(g=>`<option value="${esc(g)}" ${g===selected?'selected':''}>${esc(g)}</option>`).join(''):'<option value="" selected disabled>В этом отделении пока нет групп</option>';if(selected&&groups.includes(selected))el.value=selected;else if(groups.length)el.value=groups[0];return el.value}
function fillSlots(day,selected=''){document.querySelector('#slot-select').innerHTML=SLOTS[day].map((s,i)=>`<option value="${s}" ${s===selected?'selected':''}>${i+1} урок · ${s}</option>`).join('')}
function fillTeachers(day,slot,selected='',excludeId=null){
 const el=document.querySelector('#teacher-select'),names=normalizeNames([...data.teachers,...(selected?[selected]:[])]);
 el.innerHTML='<option value="">— Не назначен —</option>'+names.map(name=>{const busy=teacherBusy(name,day,slot,excludeId);return `<option value="${esc(name)}" ${name===selected?'selected':''} ${busy?'disabled':''}>${esc(name)}${busy?' — занят: '+esc(busy.group)+(busy.subgroup?' ('+esc(busy.subgroup)+')':''):''}</option>`}).join('');
 el.title='Преподаватели, уже занятые в это время в другой группе, недоступны для выбора.'
}
function fillSubjects(group,selected=''){const arr=subjectsFor(group);const el=document.querySelector('#subject-select');el.innerHTML=(arr.length?arr:['Сначала назначьте учебный план группе']).map(s=>`<option value="${esc(s)}" ${s===selected?'selected':''}>${esc(s)}</option>`).join('');if(!arr.length)el.value=''}
function openLesson(item=null,day=null,slot=null){
 editingId=item?.id||null;const m=document.querySelector('#modal');m.hidden=false;const f=document.querySelector('#lesson-form');document.querySelector('#modal-title').textContent=item?'Редактировать занятие':'Добавить занятие'
 f.elements.department.value=dept(item?.group||data.groups[0]||'')==='Не распределено'?data.departments[0]:dept(item?.group||data.groups[0]||'');fillGroups(f.elements.department.value,item?.group||data.groups.find(g=>dept(g)===f.elements.department.value)||'');f.elements.subgroup.value=item?.subgroup||'';f.elements.day.value=item?.day||day||'Понедельник';f.elements.room.value=item?.room||'';f.elements.note.value=item?.note||'';fillSlots(f.elements.day.value,item?.slot||slot||'');fillTeachers(f.elements.day.value,f.elements.slot.value,item?.teacher||'',editingId);fillSubjects(f.elements.group.value,item?.subject||'')
 f.elements.group.onchange=()=>{fillSubjects(f.elements.group.value)}
 f.elements.department.onchange=()=>{const selected=fillGroups(f.elements.department.value);fillSubjects(selected)}
 f.elements.day.onchange=()=>{fillSlots(f.elements.day.value);fillTeachers(f.elements.day.value,f.elements.slot.value,'',editingId)}
 f.elements.slot.onchange=()=>fillTeachers(f.elements.day.value,f.elements.slot.value,'',editingId)
}
function closeLesson(){document.querySelector('#modal').hidden=true}
function submitLesson(e){
 e.preventDefault();const f=e.currentTarget;const item={id:editingId||id(),group:f.elements.group.value,subgroup:f.elements.subgroup.value,day:f.elements.day.value,slot:f.elements.slot.value,subject:f.elements.subject.value,teacher:f.elements.teacher.value.trim(),room:f.elements.room.value.trim(),note:f.elements.note.value.trim()}
 if(!item.group||!item.subject||item.subject.startsWith('Сначала'))return alert('Назначьте группе учебный план и выберите дисциплину.')
 // Для разделённой группы обе подгруппы одной дисциплины обязаны идти в один день и один временной интервал.
 const subjectKey=String(item.subject).trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
 const subgroupMismatch=data.lessons.find(x=>x.id!==editingId&&x.group===item.group&&String(x.subject||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru')===subjectKey&&x.subgroup&&item.subgroup&&x.subgroup!==item.subgroup&&(x.day!==item.day||x.slot!==item.slot));
 if(subgroupMismatch){
  const a=document.querySelector('#form-alert');a.hidden=false;
  a.textContent='Нельзя сохранить: эта дисциплина уже назначена другой подгруппе на '+subgroupMismatch.day+', '+subgroupMismatch.slot+'. Обе подгруппы должны заниматься одновременно.';
  return;
 }
 const c=conflicts(item,editingId);if(c.length){const a=document.querySelector('#form-alert');a.hidden=false;a.textContent='Нельзя сохранить: '+[...new Set(c.map(x=>x.reason))].join('; ')+'.';return}
 const lv=loadViolations(item,editingId);if(lv.length){const a=document.querySelector('#form-alert');a.hidden=false;a.textContent='Нельзя сохранить: '+lv.join(' ');return}
 const tw=teacherWarnings(item);if(tw.length&&!confirm('ПРЕДУПРЕЖДЕНИЕ: условия расписания преподавателя не соблюдены или требуют внимания:\\n\\n'+tw.join('\\n')+'\\n\\nСохранить занятие несмотря на предупреждения?'))return;
 data.lessons=data.lessons.filter(x=>x.id!==editingId);data.lessons.push(item);if(item.teacher&&!data.teachers.includes(item.teacher))data.teachers.push(item.teacher);if(item.room&&!data.rooms.includes(item.room))data.rooms.push(item.room);closeLesson();save()
}
function openSub(){document.querySelector('#sub-modal').hidden=false}
function bind(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=e=>{e.preventDefault();if(!b.dataset.tab)return;tab=b.dataset.tab;render()})
 document.querySelector('#export').onclick=exportExcel
 document.querySelector('#reset-demo').onclick=()=>{if(confirm('Вернуть исходные справочники? Все изменения в этом браузере будут сброшены.')){data=structuredClone(blank);save()}}
 if(tab==='auto'){
  const openReview=document.querySelector('#w13-open-review');if(openReview)openReview.onclick=()=>{window.__w13ReviewOpen=true;render()};
  const closeReview=document.querySelector('#w13-close-review');if(closeReview)closeReview.onclick=()=>{window.__w13ReviewOpen=false;render()};
  const addWeek13Records=(records)=>{const imported=data.week13Reviews||{},existing=new Set((data.scheduleDemands||[]).map(x=>x.sourceId).filter(Boolean)),pending=[];records.forEach(record=>{if(!record||imported[record.id]?.added||existing.has(record.id))return;const row=[...document.querySelectorAll('[data-w13-row]')].find(r=>r.querySelector('[data-w13-add]')?.dataset.w13Add===record.id);if(!row)return;const subject=row.querySelector('.w13-subject')?.value.trim(),names=(record.teachers||'').split(' + ').map(v=>v.trim()).filter(Boolean),single=row.querySelector('.w13-teacher')?.value,teachers=names.length>1?names:(single?[single]:[]),hours=Number(record.occurrencesInWeek),confirmed=!!record.subjectNormalized||(subject&&subject!==record.subjectSource);if(!confirmed||!subject||!teachers.length||!data.groups.includes(record.group)||!Number.isInteger(hours)||hours<1||hours>36)return;pending.push({record,subject,teachers,hours})});if(!pending.length){alert('Нет выбранных записей, готовых к переносу. Уточни дисциплину и проверь назначения преподавателей.');return}const demandCount=pending.reduce((n,x)=>n+x.teachers.length,0);if(!confirm('Добавить '+pending.length+' записей ('+demandCount+' заявок с учётом подгрупп) в список автосоставления?'))return;data.scheduleDemands=data.scheduleDemands||[];data.week13Reviews=data.week13Reviews||{};pending.forEach(({record,subject,teachers,hours})=>{teachers.forEach((teacher,i)=>data.scheduleDemands.push({group:record.group,subject,hours,teacher,subgroup:teachers.length>1?(i===0?'1 подгруппа':'2 подгруппа'):(record.subgroup==='1'?'1 подгруппа':record.subgroup==='2'?'2 подгруппа':''),room:'',sourceId:record.id+'-'+i}));data.week13Reviews[record.id]={added:true,at:new Date().toISOString(),subject,teachers}});save()};
document.querySelector('#w13-add-all').onclick=()=>{const selected=[...document.querySelectorAll('[data-w13-row]')].filter(r=>r.querySelector('.w13-select')?.checked).map(r=>WEEK13_ASSIGNMENTS.find(x=>x.id===r.querySelector('[data-w13-add]')?.dataset.w13Add));addWeek13Records(selected)};
document.querySelector('#w13-select-all').onclick=()=>{const rows=[...document.querySelectorAll('[data-w13-row]')].filter(r=>!r.hidden&&!r.querySelector('.w13-select')?.disabled),all=rows.every(r=>r.querySelector('.w13-select')?.checked);rows.forEach(r=>{const c=r.querySelector('.w13-select');if(c)c.checked=!all});document.querySelector('#w13-select-visible').checked=!all};
document.querySelector('#w13-select-visible').onchange=e=>{document.querySelectorAll('[data-w13-row]').forEach(r=>{if(!r.hidden){const c=r.querySelector('.w13-select');if(c&&!c.disabled)c.checked=e.target.checked}})};
  const filterWeek13=()=>{const q=(document.querySelector('#w13-search')?.value||'').toLowerCase(),g=document.querySelector('#w13-group')?.value||'',st=document.querySelector('#w13-status')?.value||'';document.querySelectorAll('[data-w13-row]').forEach(r=>{const id=r.querySelector('[data-w13-add]')?.dataset.w13Add,x=WEEK13_ASSIGNMENTS.find(v=>v.id===id);r.hidden=(q&&!r.dataset.search.includes(q))||(g&&r.dataset.group!==g)||(st==='known'&&!x?.subjectNormalized)||(st==='unknown'&&!!x?.subjectNormalized)})};
  document.querySelector('#w13-search').oninput=filterWeek13;document.querySelector('#w13-group').onchange=filterWeek13;document.querySelector('#w13-status').onchange=filterWeek13;
  document.querySelectorAll('[data-w13-add]').forEach(button=>button.onclick=()=>{const row=button.closest('tr'),record=WEEK13_ASSIGNMENTS.find(x=>x.id===button.dataset.w13Add),c=row.querySelector('.w13-select');if(c)c.checked=true;addWeek13Records([record])});
  document.querySelector('#add-demand').onclick=()=>{const group=document.querySelector('#demand-group').value,subject=document.querySelector('#demand-subject').value.trim(),hours=Number(document.querySelector('#demand-hours').value),teacher=document.querySelector('#demand-teacher').value,subgroup=document.querySelector('#demand-subgroup').value,room=document.querySelector('#demand-room').value.trim();if(!subject||!teacher||!Number.isInteger(hours)||hours<2||hours>36||hours%2!==0){alert('Укажи дисциплину, преподавателя и чётное количество часов от 2 до 36 (2 часа = 1 пара).');return}data.scheduleDemands=data.scheduleDemands||[];data.scheduleDemands.push({group,subject,hours,teacher,subgroup,room});save()};
  document.querySelector('#clear-demands').onclick=()=>{if(confirm('Удалить все заявки на автосоставление?')){data.scheduleDemands=[];save()}};
  document.querySelector('#clear-generated').onclick=()=>{if(confirm('Удалить все занятия, созданные автосоставлением?')){data.lessons=data.lessons.filter(x=>!x.autoGenerated);save()}};
  document.querySelectorAll('[data-delete-demand]').forEach(b=>b.onclick=()=>{data.scheduleDemands.splice(Number(b.dataset.deleteDemand),1);save()});
  document.querySelector('#run-auto').onclick=()=>{const result=generateAutoSchedule(),box=document.querySelector('#auto-result');const summary='<div class="auto-summary"><b>Добавлено занятий: '+result.added.length+'</b><b>Не распределено: '+result.unplaced.length+'</b></div>';const details=result.unplaced.length?'<div class="soft-warning"><b>Не удалось разместить:</b>'+result.unplaced.map(x=>'<p>'+esc(x.group)+' · '+esc(x.subject)+' · '+esc(x.teacher)+' · час '+x.unit+'</p>').join('')+'</div>':'';const rows=result.added.map(x=>'<tr><td>'+esc(x.day)+'</td><td>'+esc(x.slot)+'</td><td>'+esc(x.group)+(x.subgroup?' · '+esc(x.subgroup):'')+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.teacher)+'</td></tr>').join('');const table=result.added.length?'<div class="table-scroll"><table class="directory"><thead><tr><th>День</th><th>Время</th><th>Группа</th><th>Дисциплина</th><th>Преподаватель</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'';save();document.querySelector('#auto-result').innerHTML=summary+details+table+'<p class="muted">Занятия добавлены в недельную сетку как предварительный вариант. Удалить их можно кнопкой «Удалить автосоставленные».</p>'};
 }
 if(tab==='teachers'){const el=document.querySelector('#teacher-workspace-select');if(el)el.onchange=e=>{window.__okptTeacherFilter=e.target.value;render()};}
 if(tab==='week'){
  document.querySelector('#add-lesson').onclick=()=>openLesson()
  document.querySelector('#prev-week').onclick=()=>shiftWeek(-7);document.querySelector('#next-week').onclick=()=>shiftWeek(7)
  document.querySelector('#week-date').onchange=e=>{data.week=e.target.value;save()}
  document.querySelector('#dept-filter').onchange=e=>{deptFilter=e.target.value;window.__okptEntityFilter='Все';render()}
  document.querySelector('#schedule-mode').onchange=e=>{window.__okptScheduleMode=e.target.value;window.__okptEntityFilter='Все';render()}
  document.querySelector('#entity-filter').onchange=e=>{window.__okptEntityFilter=e.target.value;render()}
  document.querySelectorAll('[data-open-slot]').forEach(b=>b.onclick=()=>{const day=b.dataset.openSlot,slot=b.dataset.openTime,entries=getSlotEntries(day,slot);const box=document.querySelector('#slot-details');document.querySelector('#slot-details-title').textContent=day+' · '+slot;document.querySelector('#slot-details-subtitle').textContent=entries.length+' занятий';document.querySelector('#slot-details-list').innerHTML=entries.map(x=>'<article class=\"lesson-card '+(conflicts(x,x.id).length?'has-conflict':'')+'\" data-detail-edit=\"'+x.id+'\"><b>'+esc(x.group)+(x.subgroup?' · '+esc(x.subgroup):'')+'</b><span>'+esc(x.subject)+'</span><small>'+esc(x.teacher||'Преподаватель не указан')+' · '+esc(x.room||'ауд. не указана')+'</small></article>').join('');box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'nearest'});document.querySelectorAll('[data-detail-edit]').forEach(card=>card.onclick=()=>openLesson(data.lessons.find(x=>x.id===card.dataset.detailEdit)))})
  document.querySelector('#close-slot-details').onclick=()=>document.querySelector('#slot-details').hidden=true
  document.querySelectorAll('[data-add-day]').forEach(b=>b.onclick=()=>openLesson(null,b.dataset.addDay,b.dataset.addSlot))
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openLesson(data.lessons.find(x=>x.id===b.dataset.edit)))
  document.querySelector('#close').onclick=closeLesson;document.querySelector('#cancel').onclick=closeLesson;document.querySelector('#modal').onclick=e=>{if(e.target.id==='modal')closeLesson()}
  document.querySelector('#lesson-form').onsubmit=submitLesson
 }
 if(tab==='lists'){
  document.querySelectorAll('[data-group-dept]').forEach(s=>s.onchange=()=>{data.groupDepartments[s.dataset.groupDept]=s.value;save()})
  document.querySelectorAll('.save-list').forEach(b=>b.onclick=()=>{const k=b.dataset.list;data[k]=[...new Set(document.querySelector('#list-'+k).value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean))];save()})
  document.querySelector('#save-teacher-profiles').onclick=()=>{data.teacherProfiles=data.teacherProfiles||{};document.querySelectorAll('[data-teacher-row]').forEach(row=>{const name=row.dataset.teacherRow,p={};row.querySelectorAll('[data-tf]').forEach(el=>{const k=el.dataset.tf;p[k]=['availableDays','availablePairs','preferredDays','preferredPairs','unavailableSlots'].includes(k)?parseList(el.value):el.value.trim()});data.teacherProfiles[name]=p});save()}
 }
 if(tab==='groupmap'){
  document.querySelector('#map-dept-filter').onchange=filterMapRows
  document.querySelector('#map-status-filter').onchange=filterMapRows
  document.querySelectorAll('[data-group-dept]').forEach(el=>el.onchange=()=>{const g=el.dataset.groupDept;data.groupDepartments[g]=el.value;const sp=groupSpecialty(g);if(sp&&sp.department!==el.value){delete data.groupSpecialties[g];delete data.groupCurricula[g]}save()})
  document.querySelectorAll('[data-group-specialty]').forEach(el=>el.onchange=()=>{const g=el.dataset.groupSpecialty,sp=data.specialties.find(x=>x.code===el.value);if(sp){data.groupSpecialties[g]=sp.code;data.groupDepartments[g]=sp.department;data.groupCurricula[g]=sp.curriculumId||''}else{delete data.groupSpecialties[g];delete data.groupCurricula[g]}save()})
 }
 if(tab==='plans'){
  document.querySelector('#create-plan').onclick=()=>{const name=document.querySelector('#plan-name').value.trim(),subjects=[...new Set(document.querySelector('#plan-subjects').value.split(/[\n;]+/).map(x=>x.trim()).filter(Boolean))];if(!name||!subjects.length){alert('Укажите название плана и хотя бы одну дисциплину.');return}data.curricula.push({id:id(),name,subjects});save()}
  document.querySelectorAll('[data-plan-group]').forEach(box=>box.onchange=()=>{const g=box.dataset.planGroup,pid=box.dataset.planId;if(box.checked){data.groupCurricula[g]=pid;const sp=data.specialties.find(x=>x.curriculumId===pid);if(sp)data.groupSpecialties[g]=sp.code}else if(data.groupCurricula?.[g]===pid){delete data.groupCurricula[g];delete data.groupSpecialties[g]}save()})
 }
 if(tab==='replacements'){
  const b=document.querySelector('#add-substitution');if(b)b.onclick=openSub
  document.querySelector('#review-approve-all').onclick=()=>{const pending=data.replacementReviewItems.filter(x=>x.status==='На проверке');if(!pending.length)return;if(!confirm('Подтвердить все '+pending.length+' строк, ожидающих проверки? Это отметит распознавание как проверенное, но не применит замены к расписанию.'))return;const stamp=new Date().toISOString();pending.forEach(item=>{item.status='Проверено';item.reviewedAt=stamp;delete item.reviewNote});save()}
  document.querySelector('#review-reject-all').onclick=()=>{const pending=data.replacementReviewItems.filter(x=>x.status==='На проверке');if(!pending.length)return;if(!confirm('Отклонить все '+pending.length+' строк, ожидающих проверки?'))return;const stamp=new Date().toISOString();pending.forEach(item=>{item.status='Отклонено';item.reviewedAt=stamp});save()}
  document.querySelectorAll('[data-review-approve]').forEach(button=>button.onclick=()=>{const item=data.replacementReviewItems.find(x=>String(x.id)===button.dataset.reviewApprove);if(!item||item.status!=='На проверке')return;item.status='Проверено';item.reviewedAt=new Date().toISOString();delete item.reviewNote;save()})
  document.querySelectorAll('[data-review-reject]').forEach(button=>button.onclick=()=>{const item=data.replacementReviewItems.find(x=>String(x.id)===button.dataset.reviewReject);if(!item||item.status!=='На проверке')return;item.status='Отклонено';item.reviewedAt=new Date().toISOString();save()})
  document.querySelectorAll('[data-review-reset]').forEach(button=>button.onclick=()=>{const item=data.replacementReviewItems.find(x=>String(x.id)===button.dataset.reviewReset);if(!item)return;item.status='На проверке';delete item.reviewedAt;delete item.reviewNote;save()})
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
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.teachers.map(name=>{const p=teacherProfile(name);return {'Преподаватель':name,'Статус':p.employment,'Доступные дни':p.availableDays.join(', '),'Доступные пары':p.availablePairs.join(', '),'Предпочтительные дни':p.preferredDays.join(', '),'Предпочтительные пары':p.preferredPairs.join(', '),'Недоступные интервалы':p.unavailableSlots.join(', '),'Примечание':p.note}})), 'Преподаватели')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.rooms.map(name=>({'Аудитория':name}))), 'Аудитории')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.substitutions.map(s=>{const l=data.lessons.find(x=>x.id===s.lessonId);return {'Группа':l?.group,'Занятие':l?.subject,'Исходный преподаватель':l?.teacher,'Новый преподаватель':s.teacher,'Новая аудитория':s.room,'Причина':s.reason,'Статус':s.status}})), 'Замены')
 XLSX.writeFile(wb,'ОКПТ_расписание_'+data.week+'.xlsx')
}
render()
