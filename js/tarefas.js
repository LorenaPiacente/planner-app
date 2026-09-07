/* =========================================================
 * ARQUIVO: js/tarefas.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   O sistema de tarefas recorrentes inteiro — cálculo de ocorrência
 *   (a cada X dias/semanas/meses/anos, dias da semana, dia(s) do mês),
 *   o seletor de repetição de 3 abas (compartilhado entre o hub de
 *   adicionar e o modal de editar aqui), e o modal de criar/editar uma
 *   tarefa recorrente — e a página própria de Tarefas, que lista
 *   Tarefas/Eventos pendentes de todos os dias e as Recorrentes
 *   cadastradas.
 *
 * QUANDO É USADO
 *   isRecurringOccurrence/recurringStatus são consultadas por
 *   calendario.js (visão Dia e seção "Não realizadas") sempre que
 *   precisa saber se uma tarefa recorrente ocorre num dia. As funções
 *   do seletor de repetição (recurrenceConfigHtml/wireRecurrenceConfig/
 *   readRecurrenceConfig) são usadas tanto aqui quanto em modal.js (no
 *   formulário de Tarefa do hub de adicionar). renderTarefasPage é
 *   chamado por nav.js quando state.mainSection==='tarefas'.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Cálculo de ocorrência e status de uma tarefa recorrente
 *      (isRecurringOccurrence, recurringStatus, recurringLabel)
 *   2. Seletor de repetição de 3 abas — montar HTML, conectar eventos,
 *      ler valores (recurrenceConfigHtml, wireRecurrenceConfig,
 *      readRecurrenceConfig)
 *   3. Coleta de ocorrências perdidas num período (collectMissedRecurring)
 *      — usada pela seção "Não realizadas" da Semana/Mês
 *   4. Modal de criar/editar tarefa recorrente (openRecurringTaskModal)
 *   5. Seção "Tarefas recorrentes" na visão Dia (renderRecurringToday)
 *   6. Página própria de Tarefas: coleta de pendentes de todos os dias,
 *      as 3 seções recolhíveis (Tarefas/Eventos/Recorrentes) e as
 *      linhas de cada lista
 * ========================================================= */

import { state, save } from './state.js';
import { todayISO, addDays, daysInMonth, daysBetween, pad, MONTH_SHORT, DOW_SHORT } from './dates.js';
import { ICONS } from './icons.js';
import { escapeHtml, getDaily, showInlineWarning } from './utils.js';
import { closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- cálculo de ocorrência e status ---------- */
export function isRecurringOccurrence(task, iso){
  if(iso < task.startDate) return false;
  if(task.endDate && iso > task.endDate) return false;
  if(task.kind==='interval'){
    const n = task.intervalN || task.intervalDays || 1;
    const unit = task.intervalUnit || 'day';
    const start = new Date(task.startDate+'T00:00:00');
    const target = new Date(iso+'T00:00:00');
    if(unit==='day'){
      const diff = daysBetween(task.startDate, iso);
      return diff>=0 && diff % n === 0;
    }
    if(unit==='week'){
      const diff = daysBetween(task.startDate, iso);
      return diff>=0 && diff % (n*7) === 0;
    }
    if(unit==='month'){
      const monthsDiff = (target.getFullYear()-start.getFullYear())*12 + (target.getMonth()-start.getMonth());
      if(monthsDiff<0 || monthsDiff % n !== 0) return false;
      const targetLastDay = daysInMonth(target.getFullYear(), target.getMonth());
      const expectedDay = Math.min(start.getDate(), targetLastDay);
      return target.getDate()===expectedDay;
    }
    if(unit==='year'){
      const yearsDiff = target.getFullYear()-start.getFullYear();
      if(yearsDiff<0 || yearsDiff % n !== 0) return false;
      return target.getMonth()===start.getMonth() && target.getDate()===start.getDate();
    }
    return false;
  }
  if(task.kind==='weekdays'){
    const dow = (new Date(iso+'T00:00:00').getDay()+6)%7;
    return task.weekdays.includes(dow);
  }
  if(task.kind==='monthdays'){
    const day = new Date(iso+'T00:00:00').getDate();
    return task.monthDays.includes(day);
  }
  return false;
}
export function recurringStatus(task, iso){
  if(!isRecurringOccurrence(task, iso)) return null;
  if(task.completions[iso]) return 'done';
  if(iso < todayISO()) return 'missed';
  return 'pending';
}
export function recurringLabel(task){
  if(task.kind==='interval'){
    const n = task.intervalN || task.intervalDays || 1;
    const unit = task.intervalUnit || 'day';
    const singular = {day:'dia', week:'semana', month:'mês', year:'ano'}[unit];
    const plural = {day:'dias', week:'semanas', month:'meses', year:'anos'}[unit];
    return `a cada ${n} ${n>1?plural:singular}`;
  }
  if(task.kind==='weekdays'){
    if(task.weekdays.length===7) return 'todo dia';
    const names = task.weekdays.slice().sort((a,b)=>a-b).map(i=>DOW_SHORT[i]).join(', ');
    return `semanal · ${names}`;
  }
  if(task.kind==='monthdays') return `mensal · dia ${task.monthDays.slice().sort((a,b)=>a-b).join(', ')}`;
  return '';
}

/* ---------- seletor de repetição (3 abas) ---------- */
export function recurrenceConfigHtml(idPrefix, editTask){
  const kind = editTask ? editTask.kind : 'weekdays';
  const weekdays = editTask && editTask.weekdays ? editTask.weekdays : [0,1,2,3,4,5,6];
  const monthDays = editTask && editTask.monthDays ? editTask.monthDays : [];
  const intervalN = editTask ? (editTask.intervalN || editTask.intervalDays || 1) : 1;
  const intervalUnit = editTask ? (editTask.intervalUnit || 'week') : 'week';
  return `
    <div class="rec-tabs" id="${idPrefix}Tabs">
      <button type="button" class="rec-tab ${kind==='weekdays'?'active':''}" data-k="weekdays">Diário</button>
      <button type="button" class="rec-tab ${kind==='monthdays'?'active':''}" data-k="monthdays">Mensal</button>
      <button type="button" class="rec-tab ${kind==='interval'?'active':''}" data-k="interval">Personalizado</button>
    </div>
    <div id="${idPrefix}WeekdaysPane" style="display:${kind==='weekdays'?'':'none'};">
      <div class="weekday-picker">
        ${DOW_SHORT.map((d,i)=>`<button type="button" class="wd-pill${weekdays.includes(i)?' active':''}" data-d="${i}">${d}</button>`).join('')}
      </div>
    </div>
    <div id="${idPrefix}MonthdaysPane" style="display:${kind==='monthdays'?'':'none'};">
      <div class="monthday-grid">
        ${Array.from({length:31},(_,i)=>i+1).map(n=>`<button type="button" class="md-pill${monthDays.includes(n)?' active':''}" data-n="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div id="${idPrefix}IntervalPane" style="display:${kind==='interval'?'':'none'};">
      <div class="interval-row">
        <span>A cada</span>
        <input type="number" id="${idPrefix}IntervalN" min="1" max="99" value="${intervalN}">
        <div class="interval-unit-tabs" id="${idPrefix}UnitTabs">
          <button type="button" class="unit-pill${intervalUnit==='day'?' active':''}" data-u="day">dia(s)</button>
          <button type="button" class="unit-pill${intervalUnit==='week'?' active':''}" data-u="week">semana(s)</button>
          <button type="button" class="unit-pill${intervalUnit==='month'?' active':''}" data-u="month">mês(es)</button>
          <button type="button" class="unit-pill${intervalUnit==='year'?' active':''}" data-u="year">ano(s)</button>
        </div>
      </div>
    </div>
  `;
}
export function wireRecurrenceConfig(idPrefix){
  document.querySelectorAll(`#${idPrefix}Tabs .rec-tab`).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll(`#${idPrefix}Tabs .rec-tab`).forEach(b=>b.classList.toggle('active', b===btn));
      const k = btn.dataset.k;
      document.getElementById(`${idPrefix}WeekdaysPane`).style.display = k==='weekdays'?'':'none';
      document.getElementById(`${idPrefix}MonthdaysPane`).style.display = k==='monthdays'?'':'none';
      document.getElementById(`${idPrefix}IntervalPane`).style.display = k==='interval'?'':'none';
    });
  });
  document.querySelectorAll(`#${idPrefix}WeekdaysPane .wd-pill`).forEach(btn=> btn.addEventListener('click', ()=> btn.classList.toggle('active')));
  document.querySelectorAll(`#${idPrefix}MonthdaysPane .md-pill`).forEach(btn=> btn.addEventListener('click', ()=> btn.classList.toggle('active')));
  document.querySelectorAll(`#${idPrefix}UnitTabs .unit-pill`).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll(`#${idPrefix}UnitTabs .unit-pill`).forEach(b=>b.classList.toggle('active', b===btn));
    });
  });
}
export function readRecurrenceConfig(idPrefix, anchorBtn){
  const activeTab = document.querySelector(`#${idPrefix}Tabs .rec-tab.active`);
  const kind = activeTab ? activeTab.dataset.k : 'weekdays';
  const result = {kind};
  if(kind==='weekdays'){
    result.weekdays = Array.from(document.querySelectorAll(`#${idPrefix}WeekdaysPane .wd-pill.active`)).map(b=>parseInt(b.dataset.d,10));
    if(result.weekdays.length===0){ showInlineWarning(anchorBtn, 'Escolha ao menos um dia da semana.'); return null; }
  } else if(kind==='monthdays'){
    result.monthDays = Array.from(document.querySelectorAll(`#${idPrefix}MonthdaysPane .md-pill.active`)).map(b=>parseInt(b.dataset.n,10));
    if(result.monthDays.length===0){ showInlineWarning(anchorBtn, 'Escolha ao menos um dia do mês.'); return null; }
  } else {
    let n = parseInt(document.getElementById(`${idPrefix}IntervalN`).value,10);
    if(isNaN(n)||n<1) n=1;
    const unitBtn = document.querySelector(`#${idPrefix}UnitTabs .unit-pill.active`);
    result.intervalN = n;
    result.intervalUnit = unitBtn ? unitBtn.dataset.u : 'week';
  }
  return result;
}

/* ---------- ocorrências perdidas num período ---------- */
export function collectMissedRecurring(startIso, endIso){
  const items = [];
  state.recurringTasks.forEach(task=>{
    let iso = startIso;
    while(iso <= endIso){
      if(recurringStatus(task, iso)==='missed') items.push({task, iso});
      iso = addDays(iso, 1);
    }
  });
  items.sort((a,b)=> a.iso.localeCompare(b.iso));
  return items;
}

/* ---------- modal de criar/editar tarefa recorrente ---------- */
export function openRecurringTaskModal(editTask){
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>${editTask?'Editar':'Nova'} tarefa recorrente</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Texto <input type="text" id="rtText" value="${editTask?escapeHtml(editTask.text):''}" placeholder="Ex: regar as plantas"></label>
      <label>Repetição</label>
      ${recurrenceConfigHtml('rt', editTask)}
      <label>Início <input type="date" id="rtStart" value="${editTask?editTask.startDate:todayISO()}"></label>
      <label>Fim (opcional) <input type="date" id="rtEnd" value="${editTask&&editTask.endDate?editTask.endDate:''}"></label>
    </div>
    <button class="btn-primary" id="rtSaveBtn" style="margin-top:14px;">Salvar</button>
    ${editTask?`<button type="button" class="btn-primary" id="rtDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir tarefa recorrente</button>`:''}
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  wireRecurrenceConfig('rt');

  document.getElementById('rtSaveBtn').addEventListener('click', ()=>{
    const text = document.getElementById('rtText').value.trim();
    if(!text){ showInlineWarning(document.getElementById('rtSaveBtn'), 'Digite um texto.'); return; }
    const cfg = readRecurrenceConfig('rt', document.getElementById('rtSaveBtn'));
    if(!cfg) return;
    const startDate = document.getElementById('rtStart').value || todayISO();
    const endDate = document.getElementById('rtEnd').value || null;
    if(editTask){
      editTask.text=text; editTask.kind=cfg.kind; editTask.startDate=startDate; editTask.endDate=endDate;
      editTask.weekdays=cfg.weekdays; editTask.monthDays=cfg.monthDays;
      editTask.intervalN=cfg.intervalN; editTask.intervalUnit=cfg.intervalUnit;
      delete editTask.intervalDays;
    } else {
      state.recurringTasks.push({
        id:Date.now()+Math.random(), text, kind:cfg.kind, startDate, endDate,
        weekdays:cfg.weekdays, monthDays:cfg.monthDays, intervalN:cfg.intervalN, intervalUnit:cfg.intervalUnit,
        completions:{}
      });
    }
    save(); closeDaySettingsModal();
  });
  if(editTask){
    document.getElementById('rtDeleteBtn').addEventListener('click', ()=>{
      state.recurringTasks = state.recurringTasks.filter(x=>x.id!==editTask.id);
      save(); closeDaySettingsModal();
    });
  }
}

/* ---------- seção "Tarefas recorrentes" na visão Dia ---------- */
export function renderRecurringToday(iso, tasks){
  const wrap = document.getElementById('recurringList');
  wrap.innerHTML = '';
  tasks.forEach(t=>{
    const status = recurringStatus(t, iso); // 'done' ou 'pending' (não 'missed' pois iso é hoje ou futuro aqui)
    const row = document.createElement('div');
    row.className = 'thought-item recurring-item'+(status==='done'?' done':'');
    row.innerHTML = `
      <input type="checkbox" ${status==='done'?'checked':''}>
      <span class="ttext">${escapeHtml(t.text)}</span>
      <span class="recurring-tag">${ICONS.repeat} ${recurringLabel(t)}</span>
      <button class="edit" title="Editar">${ICONS.pencil}</button>
    `;
    row.querySelector('input[type=checkbox]').addEventListener('change',(e)=>{
      if(e.target.checked) t.completions[iso] = true;
      else delete t.completions[iso];
      save(); refreshCurrentDay();
    });
    row.querySelector('.edit').addEventListener('click', ()=> openRecurringTaskModal(t));
    wrap.appendChild(row);
  });
}

/* ---------- página própria de Tarefas ---------- */
function collectAllTasks(){
  const tarefas = [];
  const eventos = [];
  Object.keys(state.daily).forEach(iso=>{
    const d = state.daily[iso];
    if(!d) return;
    (d.todos||[]).forEach((t,idx)=>{
      if(!t.done) tarefas.push({iso, text:t.text, time:null, idx, source:'todo'});
    });
    (d.tasks||[]).forEach(t=>{
      if(t.done) return;
      const entry = {iso, text:t.text, time:`${pad(t.start)}h`, id:t.id, source:'task'};
      if(t.kind==='evento') eventos.push(entry);
      else tarefas.push(entry);
    });
  });
  tarefas.sort((a,b)=> a.iso.localeCompare(b.iso));
  eventos.sort((a,b)=> a.iso.localeCompare(b.iso));
  return {tarefas, eventos};
}
export function renderTarefasPage(root){
  const {tarefas, eventos} = collectAllTasks();
  root.innerHTML = `
    <div class="view-header centered"><h2 class="view-title">Tarefas</h2></div>
    <div class="task-page-section">
      <button type="button" class="task-page-toggle" id="toggleTarefas">
        <span>${ICONS.checkSquare} Tarefas <span class="tp-count">${tarefas.length}</span></span>
        <span class="tp-chevron">▾</span>
      </button>
      <div class="task-page-list" id="tarefasList"></div>
    </div>
    <div class="task-page-section">
      <button type="button" class="task-page-toggle" id="toggleEventos">
        <span>${ICONS.calendar} Eventos <span class="tp-count">${eventos.length}</span></span>
        <span class="tp-chevron">▾</span>
      </button>
      <div class="task-page-list" id="eventosList"></div>
    </div>
    <div class="task-page-section">
      <button type="button" class="task-page-toggle" id="toggleRecorrentes">
        <span>${ICONS.repeat} Recorrentes <span class="tp-count">${state.recurringTasks.length}</span></span>
        <span class="tp-chevron">▾</span>
      </button>
      <div class="task-page-list" id="recorrentesList"></div>
    </div>
    <button class="btn-primary" id="addRecurringBtn" style="margin-top:14px;">+ Nova tarefa recorrente</button>
  `;
  renderTaskPageList('tarefasList', tarefas);
  renderTaskPageList('eventosList', eventos);
  renderRecurringManageList('recorrentesList');
  document.getElementById('toggleTarefas').addEventListener('click', ()=> toggleTaskPageSection('tarefasList','toggleTarefas'));
  document.getElementById('toggleEventos').addEventListener('click', ()=> toggleTaskPageSection('eventosList','toggleEventos'));
  document.getElementById('toggleRecorrentes').addEventListener('click', ()=> toggleTaskPageSection('recorrentesList','toggleRecorrentes'));
  document.getElementById('addRecurringBtn').addEventListener('click', ()=> openRecurringTaskModal());
}
function renderRecurringManageList(wrapId){
  const wrap = document.getElementById(wrapId);
  if(state.recurringTasks.length===0){
    wrap.innerHTML = `<p class="empty-state">Nenhuma tarefa recorrente cadastrada.</p>`;
    return;
  }
  wrap.innerHTML = '';
  state.recurringTasks.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'task-page-row';
    row.innerHTML = `
      <span class="tpr-text">${escapeHtml(t.text)}</span>
      <span class="recurring-tag">${recurringLabel(t)}</span>
      <button class="edit" title="Editar">${ICONS.pencil}</button>
    `;
    row.querySelector('.edit').addEventListener('click', ()=> openRecurringTaskModal(t));
    wrap.appendChild(row);
  });
}
export function toggleTaskPageSection(listId, btnId){
  const list = document.getElementById(listId);
  const btn = document.getElementById(btnId);
  const collapsed = list.style.display==='none';
  list.style.display = collapsed ? '' : 'none';
  btn.querySelector('.tp-chevron').textContent = collapsed ? '▾' : '▸';
}
function renderTaskPageList(wrapId, items){
  const wrap = document.getElementById(wrapId);
  if(items.length===0){
    wrap.innerHTML = `<p class="empty-state">Nada pendente.</p>`;
    return;
  }
  wrap.innerHTML = '';
  items.forEach(it=>{
    const dt = new Date(it.iso+'T00:00:00');
    const row = document.createElement('div');
    row.className='task-page-row';
    row.innerHTML = `
      <button type="button" class="tpr-check" title="Marcar como feita"></button>
      <span class="tpr-date">${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}</span>
      ${it.time?`<span class="tpr-time">${it.time}</span>`:''}
      <span class="tpr-text">${escapeHtml(it.text)}</span>
      <button class="tpr-goto" title="Ir para o dia">›</button>
    `;
    row.querySelector('.tpr-check').addEventListener('click', ()=>{
      const d = getDaily(it.iso);
      if(it.source==='todo'){ if(d.todos[it.idx]) d.todos[it.idx].done = true; }
      else { const t = d.tasks.find(x=>x.id===it.id); if(t) t.done = true; }
      save(); renderTarefasPage(document.getElementById('viewRoot'));
    });
    row.querySelector('.tpr-goto').addEventListener('click', ()=>{
      state.day = it.iso; state.mainSection='calendario'; state.view='diario'; save(); renderAll();
    });
    wrap.appendChild(row);
  });
}
