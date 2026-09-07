/* =========================================================
 * ARQUIVO: js/calendario.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   As 4 visões do calendário — Ano, Mês, Semana e Dia — e tudo que é
 *   específico da visão Dia mas não tem página própria (prioridades,
 *   agenda por horário, tarefas sem horário, lembretes do dia). É o
 *   maior módulo do app porque a visão Dia funciona como um painel
 *   que reúne um pedaço de cada outra área (hábitos, remédios,
 *   nutrição, pensamentos, financeiro, tarefas recorrentes) — por
 *   isso importa render-functions de quase todo módulo de área.
 *
 * QUANDO É USADO
 *   Sempre que state.mainSection==='calendario' — é a tela inicial do
 *   app. refreshDaySections/refreshCurrentDay também são chamadas por
 *   outras áreas sempre que algo na visão Dia muda (ex: marcar um
 *   hábito), pra atualizar só aquele pedaço sem redesenhar tudo.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Frase do dia (decorativa, no topo da visão Dia)
 *   2. Visão Ano (grade de 12 mini-calendários)
 *   3. Visão Mês (grade de semanas, navegação por mês)
 *   4. Helpers de semana-dentro-do-mês (usados pela Semana e pelo
 *      seletor de mês) e lembretes semanais (usados pela Semana e
 *      pelo Mês)
 *   5. Seção "Não realizadas" (tarefas recorrentes perdidas) —
 *      compartilhada entre Semana e Mês
 *   6. Visão Semana (cards por dia com pré-visualização configurável)
 *   7. Visão Dia (cabeçalho + monta a casca das seções; o conteúdo de
 *      cada seção é preenchido por refreshDaySections)
 *   8. refreshCurrentDay / refreshDaySections — atualiza as seções da
 *      visão Dia sem redesenhar a página inteira
 *   9. Prioridades do dia (derivadas das tarefas marcadas com estrela)
 *   10. Agenda por horário (a grade de tarefas/eventos com hora)
 *   11. Tarefas sem horário + o mini-seletor de horário inline
 *   12. Lembretes do dia (distintos dos lembretes semanais)
 * ========================================================= */

import { state, save } from './state.js';
import {
  todayISO, pad, mondayOf, addDays, daysInMonth,
  weekdayLabel, fmtLongDate, MONTH_NAMES, MONTH_SHORT, DOW_SHORT, DOW_MINI
} from './dates.js';
import { ICONS } from './icons.js';
import { getDaily, escapeHtml, dayHasData, dayItemCount, fmtMoney } from './utils.js';
import { openAddModal, openEditModal, closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import {
  collectMissedRecurring, toggleTaskPageSection, isRecurringOccurrence,
  renderRecurringToday
} from './tarefas.js';
import { renderHabits } from './habitos.js';
import { medActiveOnDay, medDoseTimes, renderMeds } from './medicamentos.js';
import { MEALS, renderNutrition } from './nutricao.js';
import { renderThoughts } from './pensamentos.js';
import { renderDayFinance } from './financas.js';

/* ---------- frase do dia ---------- */
const PHRASES = [
  'Um passo pequeno hoje ainda é um passo.',
  'Nem tudo precisa ser terminado hoje — só precisa ser começado.',
  'Progresso silencioso também é progresso.',
  'Respire fundo antes de abrir a agenda.',
  'O que for essencial hoje, vai caber. O resto espera.',
  'Feito é melhor do que perfeito, principalmente num dia corrido.',
  'Cuide do seu ritmo antes de cuidar da lista.',
  'Cada tarefa concluída é um tijolo, não a casa inteira.',
  'Está tudo bem se hoje for só sobre o básico.',
  'Organizar o dia também é uma forma de cuidar de si.',
  'Uma coisa de cada vez já é o suficiente.',
  'O que importa também merece tempo, não só o que é urgente.',
  'Pequenas pausas fazem parte do trabalho, não atrapalham ele.',
  'Comemore o que deu certo antes de listar o que falta.',
  'Hoje é só hoje — amanhã você reorganiza de novo.',
  'Nem todo dia precisa ser produtivo pra ter valido a pena.',
  'Você não precisa dar conta de tudo sozinha o tempo todo.',
  'Anote o pensamento e solte — ele não precisa ficar girando na cabeça.',
  'Um hábito cuidado por dia já muda o mês inteiro.',
  'A ordem das tarefas pode mudar; o cuidado com você, não.'
];
function phraseOfDay(iso){
  let sum = 0;
  for(let i=0;i<iso.length;i++) sum += iso.charCodeAt(i);
  return PHRASES[sum % PHRASES.length];
}

/* ---------- visão Ano ---------- */
export function renderYear(root){
  const html = `
    <div class="view-header">
      <h2 class="view-title">${state.year}</h2>
      <div class="step-btns">
        <button class="icon-btn" id="yPrev">‹</button>
        <button class="today-btn" id="yToday">Hoje</button>
        <button class="icon-btn" id="yNext">›</button>
      </div>
    </div>
    <div class="year-grid" id="yearGrid"></div>
  `;
  root.innerHTML = html;
  document.getElementById('yPrev').onclick=()=>{ state.year--; save(); renderAll(); };
  document.getElementById('yNext').onclick=()=>{ state.year++; save(); renderAll(); };
  document.getElementById('yToday').onclick=()=>{ state.year=new Date().getFullYear(); save(); renderAll(); };

  const grid = document.getElementById('yearGrid');
  const today = todayISO();
  for(let m=0;m<12;m++){
    const wrap = document.createElement('div');
    wrap.className='mini-month';
    const dim = daysInMonth(state.year, m);
    const lastIso = `${state.year}-${pad(m+1)}-${pad(dim)}`;
    const gridStart = mondayOf(new Date(state.year, m, 1));

    const rows = [];
    let cursor = gridStart;
    while(true){
      const days = [];
      for(let i=0;i<7;i++) days.push(addDays(cursor, i));
      rows.push({weekStart: cursor, days});
      if(new Date(days[6]+'T00:00:00') >= new Date(lastIso+'T00:00:00')) break;
      cursor = addDays(cursor, 7);
    }

    let cells = `<span class="wk-corner">#</span>`;
    DOW_MINI.forEach(d=> cells += `<span>${d}</span>`);
    rows.forEach((row, idx)=>{
      const wn = idx + 1;
      cells += `<button type="button" class="wk-num" data-ws="${row.weekStart}">${pad(wn)}</button>`;
      row.days.forEach(iso=>{
        const dt = new Date(iso+'T00:00:00');
        if(dt.getFullYear()===state.year && dt.getMonth()===m){
          const cls = ['mday'];
          if(iso===today) cls.push('today');
          if(dayHasData(iso)) cls.push('has-data');
          cells += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}">${dt.getDate()}</button>`;
        } else {
          cells += `<div class="mday empty"></div>`;
        }
      });
    });
    wrap.innerHTML = `<button class="mini-title">${MONTH_NAMES[m]}</button><div class="mini-grid">${cells}</div>`;
    wrap.querySelector('.mini-title').addEventListener('click', ()=>{
      state.month = m; state.view='mensal'; save(); renderAll();
    });
    wrap.querySelectorAll('.mday:not(.empty)').forEach(el=>{
      el.addEventListener('click', ()=>{
        state.day = el.dataset.iso; state.view='diario'; save(); renderAll();
      });
    });
    wrap.querySelectorAll('.wk-num').forEach(el=>{
      el.addEventListener('click', ()=>{
        state.weekStart = el.dataset.ws; state.view='semanal'; save(); renderAll();
      });
    });
    grid.appendChild(wrap);
  }
}

/* ---------- visão Mês ---------- */
export function renderMonth(root){
  const dim = daysInMonth(state.year, state.month);
  const firstIso = `${state.year}-${pad(state.month+1)}-01`;
  const lastIso = `${state.year}-${pad(state.month+1)}-${pad(dim)}`;
  const html = `
    <div class="view-header centered">
      <div class="month-nav-center">
        <button class="icon-btn" id="mPrev">‹</button>
        <h2 class="view-title">${MONTH_NAMES[state.month]} de ${state.year}</h2>
        <button class="icon-btn" id="mNext">›</button>
      </div>
    </div>
    <div class="month-grid" id="monthGrid"></div>
    ${renderMissedSection('monthMissed', firstIso, lastIso)}
  `;
  root.innerHTML = html;
  document.getElementById('mPrev').onclick=()=>{ shiftMonth(-1); };
  document.getElementById('mNext').onclick=()=>{ shiftMonth(1); };
  wireMissedSection('monthMissed', firstIso, lastIso);

  const grid = document.getElementById('monthGrid');

  const headerRow = document.createElement('div');
  headerRow.className = 'month-header-row';
  const corner = document.createElement('div'); corner.className='month-corner'; headerRow.appendChild(corner);
  DOW_SHORT.forEach(d=>{
    const el=document.createElement('div'); el.className='dow'; el.textContent=d; headerRow.appendChild(el);
  });
  grid.appendChild(headerRow);

  const gridStart = mondayOf(new Date(state.year, state.month, 1));
  const today = todayISO();

  let cursor = gridStart;
  while(true){
    const weekStart = cursor;
    const weekRow = document.createElement('div');
    weekRow.className = 'month-week-row';

    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'wk-remind-btn';
    const weekItems = (state.weeklyReminders && state.weeklyReminders[weekStart]) || [];
    const undoneCount = weekItems.filter(r=>!r.done).length;
    const MAX_PREVIEW_LINES = 3;
    const shown = weekItems.slice(0, MAX_PREVIEW_LINES);
    const extra = weekItems.length - shown.length;
    const previewHtml = shown.map(t=>
      `<span class="wrp-line ${t.done?'wk-remind-done':''}">${escapeHtml(t.text)}</span>`
    ).join('') + (extra>0 ? `<span class="wrp-more">+${extra}</span>` : '');
    remBtn.innerHTML = `
      <div class="wk-remind-top">
        <span class="wk-remind-icon">${ICONS.pin}</span>
        ${undoneCount>0?`<span class="wk-remind-badge">${undoneCount}</span>`:''}
      </div>
      ${weekItems.length?`<span class="wk-remind-preview">${previewHtml}</span>`:''}
    `;
    remBtn.title = 'Lembretes da semana';
    remBtn.addEventListener('click', ()=> openWeekReminderModal(weekStart));
    weekRow.appendChild(remBtn);

    for(let i=0;i<7;i++){
      const iso = addDays(cursor, i);
      const dt = new Date(iso+'T00:00:00');
      if(dt.getFullYear()===state.year && dt.getMonth()===state.month){
        const el = document.createElement('div');
        el.className = 'day-cell' + (iso===today?' today':'');
        const note = state.monthlyNotes[iso] || '';
        const itemCount = dayItemCount(iso);
        el.innerHTML = `
          <div class="dcell-top">
            <div class="dcell-left">
              <button type="button" class="dnum">${dt.getDate()}</button>
              ${itemCount>0?`<span class="dcell-badge">${itemCount}</span>`:''}
            </div>
            <button type="button" class="dcell-add" title="Adicionar neste dia">+</button>
          </div>
          <span class="dnote">${escapeHtml(note)}</span>
        `;
        el.querySelector('.dcell-add').addEventListener('click', (e)=>{
          e.stopPropagation();
          openAddModal(undefined, iso);
        });
        el.addEventListener('click', ()=>{
          state.day = iso; state.view='diario'; save(); renderAll();
        });
        weekRow.appendChild(el);
      } else {
        const el = document.createElement('div'); el.className='day-cell empty'; weekRow.appendChild(el);
      }
    }
    grid.appendChild(weekRow);

    const weekEndIso = addDays(cursor, 6);
    if(new Date(weekEndIso+'T00:00:00') >= new Date(lastIso+'T00:00:00')) break;
    cursor = addDays(cursor, 7);
  }
}
export function shiftMonth(delta){
  let m = state.month + delta;
  let y = state.year;
  if(m<0){ m=11; y--; } else if(m>11){ m=0; y++; }
  state.month=m; state.year=y; save(); renderAll();
}

/* ---------- semana-dentro-do-mês + lembretes semanais ---------- */
function weekMonthContext(weekStartIso){
  const today = todayISO();
  const weekEnd = addDays(weekStartIso, 6);
  if(today >= weekStartIso && today <= weekEnd){
    const d = new Date(today+'T00:00:00');
    return {year: d.getFullYear(), month: d.getMonth()};
  }
  const thu = addDays(weekStartIso, 3);
  const d = new Date(thu+'T00:00:00');
  return {year: d.getFullYear(), month: d.getMonth()};
}
function weekNumberInMonth(weekStartIso){
  const ctx = weekMonthContext(weekStartIso);
  let count = 1;
  let cursor = addDays(weekStartIso, -7);
  while(true){
    const c = weekMonthContext(cursor);
    if(c.year===ctx.year && c.month===ctx.month){ count++; cursor = addDays(cursor, -7); }
    else break;
  }
  return count;
}
export function firstWeekStartOfMonth(year, month){
  let ws = mondayOf(new Date(year, month, 1));
  const ctx = weekMonthContext(ws);
  if(ctx.year!==year || ctx.month!==month){
    ws = addDays(ws, 7);
  }
  return ws;
}

export function getWeekReminders(weekStart){
  if(!state.weeklyReminders) state.weeklyReminders = {};
  if(!state.weeklyReminders[weekStart]) state.weeklyReminders[weekStart] = [];
  return state.weeklyReminders[weekStart];
}
export function renderWeekReminderList(weekStart, wrapId){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  const items = getWeekReminders(weekStart);
  wrap.innerHTML = '';
  if(items.length===0) return;
  items.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'thought-item reminder-item'+(t.done?' done':'');
    row.innerHTML = `<input type="checkbox" ${t.done?'checked':''}><input type="text" class="ttext" value="${escapeHtml(t.text)}"><button class="rm" title="Excluir">${ICONS.trash}</button>`;
    row.querySelector('input[type=checkbox]').addEventListener('change',(e)=>{
      t.done = e.target.checked; save(); row.classList.toggle('done', t.done);
    });
    row.querySelector('input.ttext').addEventListener('input',(e)=>{ t.text = e.target.value; save(); });
    row.querySelector('.rm').addEventListener('click', ()=>{
      state.weeklyReminders[weekStart] = items.filter(x=>x.id!==t.id);
      save();
      renderWeekReminderList(weekStart, wrapId);
    });
    wrap.appendChild(row);
  });
}
export function addWeekReminder(weekStart, inputId, wrapId){
  const inp = document.getElementById(inputId);
  const text = inp.value.trim();
  if(!text) return;
  getWeekReminders(weekStart).push({id:Date.now()+Math.random(), text, done:false});
  inp.value='';
  save();
  renderWeekReminderList(weekStart, wrapId);
}
function openWeekReminderModal(weekStart){
  const sheet = document.getElementById('settingsSheet');
  const weekEnd = addDays(weekStart, 6);
  sheet.innerHTML = `
    <div class="modal-header"><h3>${ICONS.pin} Lembretes da semana</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <p class="schedule-hint" style="text-align:center;margin-bottom:12px;">${fmtLongDate(weekStart)} — ${fmtLongDate(weekEnd)}</p>
    <div id="weekRemList"></div>
    <div class="add-row" style="margin-top:10px;">
      <input type="text" id="weekRemInput" placeholder="Novo lembrete da semana...">
      <button class="btn-primary" id="weekRemAdd">Adicionar</button>
    </div>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  renderWeekReminderList(weekStart, 'weekRemList');
  document.getElementById('weekRemAdd').onclick = ()=> addWeekReminder(weekStart, 'weekRemInput', 'weekRemList');
  document.getElementById('weekRemInput').addEventListener('keydown',(e)=>{ if(e.key==='Enter') addWeekReminder(weekStart, 'weekRemInput', 'weekRemList'); });
}

/* ---------- seção "Não realizadas" (Semana + Mês) ---------- */
function renderMissedSection(containerId, startIso, endIso){
  const missed = collectMissedRecurring(startIso, endIso);
  if(missed.length===0) return '';
  return `
    <div class="task-page-section missed-section" id="${containerId}">
      <button type="button" class="task-page-toggle missed-toggle" id="${containerId}Toggle">
        <span>Não realizadas <span class="tp-count">${missed.length}</span></span>
        <span class="tp-chevron">▾</span>
      </button>
      <div class="task-page-list" id="${containerId}List"></div>
    </div>
  `;
}
function wireMissedSection(containerId, startIso, endIso){
  const el = document.getElementById(containerId);
  if(!el) return;
  const missed = collectMissedRecurring(startIso, endIso);
  const listWrap = document.getElementById(containerId+'List');
  listWrap.innerHTML = missed.map(({task,iso})=>{
    const dt = new Date(iso+'T00:00:00');
    return `<div class="task-page-row missed-row">
      <span class="tpr-date">${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}</span>
      <span class="tpr-text">${escapeHtml(task.text)}</span>
    </div>`;
  }).join('');
  document.getElementById(containerId+'Toggle').addEventListener('click', ()=> toggleTaskPageSection(containerId+'List', containerId+'Toggle'));
}

/* ---------- visão Semana ---------- */
export function renderWeek(root){
  const start = state.weekStart;
  const end = addDays(start,6);
  const weekNum = weekNumberInMonth(start);
  const html = `
    <div class="view-header">
      <div class="week-nav-center">
        <button class="icon-btn" id="wPrev">‹</button>
        <h2 class="view-title">Semana ${pad(weekNum)}</h2>
        <button class="icon-btn" id="wNext">›</button>
      </div>
      <div class="step-btns">
        <button class="icon-btn" id="wSettingsBtn" title="Configurar o que aparece">${ICONS.gear}</button>
      </div>
    </div>
    <p class="week-range">${fmtLongDate(start)} — ${fmtLongDate(end)}</p>

    <div class="week-grid" id="weekGrid"></div>

    <div class="week-reminders">
      <h3>${ICONS.pin} Lembretes da semana</h3>
      <div id="weekRemInlineList"></div>
      <div class="add-row">
        <input type="text" id="weekRemInlineInput" placeholder="Novo lembrete da semana...">
        <button class="btn-primary" id="weekRemInlineAdd">Adicionar</button>
      </div>
    </div>
    ${renderMissedSection('weekMissed', start, end)}
  `;
  root.innerHTML = html;
  document.getElementById('wPrev').onclick=()=>{ state.weekStart=addDays(state.weekStart,-7); save(); renderAll(); };
  document.getElementById('wNext').onclick=()=>{ state.weekStart=addDays(state.weekStart,7); save(); renderAll(); };
  document.getElementById('wSettingsBtn').onclick = openWeekSettingsModal;
  wireMissedSection('weekMissed', start, end);

  renderWeekReminderList(start, 'weekRemInlineList');
  document.getElementById('weekRemInlineAdd').onclick = ()=> addWeekReminder(start, 'weekRemInlineInput', 'weekRemInlineList');
  document.getElementById('weekRemInlineInput').addEventListener('keydown',(e)=>{
    if(e.key==='Enter') addWeekReminder(start, 'weekRemInlineInput', 'weekRemInlineList');
  });

  const grid = document.getElementById('weekGrid');
  const today = todayISO();
  for(let i=0;i<7;i++){
    const iso = addDays(start,i);
    const d = new Date(iso+'T00:00:00');
    const col = document.createElement('div');
    col.className='week-day'+(iso===today?' today':'');
    col.innerHTML = `
      <div class="wd-header">
        <div class="wd-label-block">
          <span class="wd-label">${DOW_SHORT[i]}</span>
          <span class="wd-num">${d.getDate()}</span>
        </div>
        <button type="button" class="wd-add-btn" title="Adicionar neste dia">+</button>
      </div>
      <div class="week-day-tasks" data-iso="${iso}"></div>
    `;
    col.querySelector('.wd-add-btn').addEventListener('click', (e)=>{
      e.stopPropagation();
      openAddModal(undefined, iso);
    });
    col.addEventListener('click', ()=>{
      state.day=iso; state.view='diario'; save(); renderAll();
    });
    grid.appendChild(col);
    renderWeekDayTasks(col.querySelector('.week-day-tasks'), iso);
  }
}

function renderWeekDayTasks(wrap, iso){
  const dd = state.daily[iso] ? getDaily(iso) : null;
  const show = state.weekShow;
  let html = '';

  if(show.tasks){
    const timed = (dd && dd.tasks) ? dd.tasks.slice().sort((a,b)=>a.start-b.start) : [];
    const untimed = (dd && dd.todos) ? dd.todos : [];
    if(timed.length>0 || untimed.length>0){
      html += `<div class="wdt-group">` +
        timed.map(t=>`<div class="wdt-item${t.done?' done':''}"><span class="wdt-time">${pad(t.start)}h</span><span class="wdt-text">${escapeHtml(t.text)}</span></div>`).join('') +
        untimed.map(t=>`<div class="wdt-item${t.done?' done':''}"><span class="wdt-text">${escapeHtml(t.text)}</span></div>`).join('') +
        `</div>`;
    }
  }

  if(show.habits && dd){
    const marked = state.habits.filter(h=> dd.habitLog[h.id]);
    if(marked.length>0){
      html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Hábitos</div>` +
        marked.map(h=>`<div class="wdt-item done"><span class="wdt-text">✓ ${escapeHtml(h.name)}</span></div>`).join('') +
        `</div>`;
    }
  }

  if(show.meds && dd){
    const activeMeds = state.medications.filter(m=> medActiveOnDay(m, iso));
    const withDoses = activeMeds.filter(m=> (dd.medLog[m.id]||[]).some(Boolean));
    if(withDoses.length>0){
      html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Medicação</div>` +
        withDoses.map(m=>{
          const arr = dd.medLog[m.id]||[];
          const dayDoseCount = medDoseTimes(m, iso).length;
          const takenCount = arr.slice(0, dayDoseCount).filter(Boolean).length;
          return `<div class="wdt-item"><span class="wdt-text">${escapeHtml(m.name)} · ${takenCount}/${dayDoseCount}</span></div>`;
        }).join('') +
        `</div>`;
    }
  }

  if(show.meals && dd && dd.nutrition){
    const mealItems = MEALS.flatMap(meal=> (dd.nutrition[meal.id]||[]).map(it=>({meal:meal.label, text:it.text})));
    if(mealItems.length>0){
      html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Refeições</div>` +
        mealItems.map(it=>`<div class="wdt-item"><span class="wdt-text">${escapeHtml(it.meal)}: ${escapeHtml(it.text)}</span></div>`).join('') +
        `</div>`;
    }
  }

  if(show.expenses){
    const items = state.finance.filter(t=>t.date===iso);
    if(items.length>0){
      html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Gastos</div>` +
        items.map(t=>`<div class="wdt-item"><span class="wdt-text">${escapeHtml(t.desc)}</span><span class="${t.type==='in'?'amt-in':'amt-out'}" style="font-size:.65rem;">${t.type==='in'?'+':'-'}${fmtMoney(t.value)}</span></div>`).join('') +
        `</div>`;
    }
  }

  if(show.thoughts && dd && dd.thoughts.length>0){
    html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Pensamentos</div>` +
      dd.thoughts.map(t=>`<div class="wdt-item"><span class="wdt-text">${escapeHtml(t.text)}</span></div>`).join('') +
      `</div>`;
  }

  if(show.reminders && dd && dd.reminders.length>0){
    html += `<div class="wdt-group wdt-sub"><div class="wdt-sub-label">Lembretes</div>` +
      dd.reminders.map(t=>`<div class="wdt-item${t.done?' done':''}"><span class="wdt-text">${t.done?'✓ ':''}${escapeHtml(t.text)}</span></div>`).join('') +
      `</div>`;
  }

  if(html===''){
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = html;
}

function openWeekSettingsModal(){
  const sheet = document.getElementById('settingsSheet');
  const opts = [
    {key:'tasks', label:'Tarefas e eventos'},
    {key:'habits', label:'Hábitos marcados'},
    {key:'meds', label:'Medicação tomada'},
    {key:'meals', label:'Refeições'},
    {key:'expenses', label:'Gastos e recebimentos'},
    {key:'thoughts', label:'Pensamentos'},
    {key:'reminders', label:'Lembretes'}
  ];
  sheet.innerHTML = `
    <div class="modal-header"><h3>${ICONS.gear} Mostrar na semana</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="week-settings-list">
      ${opts.map(o=>`
        <label class="week-settings-row">
          <input type="checkbox" data-key="${o.key}" ${state.weekShow[o.key]?'checked':''}>
          ${o.label}
        </label>`).join('')}
    </div>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  sheet.querySelectorAll('input[type=checkbox]').forEach(ck=>{
    ck.addEventListener('change', ()=>{
      state.weekShow[ck.dataset.key] = ck.checked;
      save(); renderAll();
    });
  });
}

/* ---------- visão Dia ---------- */
export function renderDay(root){
  const iso = state.day;
  const d = getDaily(iso);
  const dt = new Date(iso+'T00:00:00');

  const html = `
    <div class="day-view-top">
      <div class="day-nav-center">
        <button class="icon-btn" id="dPrev">‹</button>
        <div class="day-title-block">
          <h2 class="view-title">${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]}</h2>
          <span class="weekday-label">${weekdayLabel(iso)} · ${dt.getFullYear()}</span>
        </div>
        <button class="icon-btn" id="dNext">›</button>
      </div>
    </div>
    <p class="day-quote">"${phraseOfDay(iso)}"</p>

    <div class="day-week-reminders" id="dayWeekRemindersSection" style="display:none;">
      <h3>${ICONS.pin} Lembretes da semana</h3>
      <div id="dayWeekRemindersList"></div>
    </div>

    <div class="schedule">
      <div class="schedule-header">
        <h3>Agenda por horário</h3>
        <button class="icon-btn" id="dSettingsBtn" title="Configurar horário do dia">${ICONS.gear}</button>
      </div>
      <div class="schedule-wrap">
        <div class="hour-rail" id="hourRail"></div>
        <div class="schedule-body" id="scheduleBody"></div>
      </div>
    </div>

    <div class="priorities" id="prioritySection" style="display:none;">
      <h3>Prioridades do dia</h3>
      <div id="priorityList"></div>
    </div>

    <div class="todo-list" id="todoSection" style="display:none;">
      <h3>Tarefas sem horário</h3>
      <div id="todos"></div>
    </div>

    <div class="recurring-list" id="recurringSection" style="display:none;">
      <h3>Tarefas recorrentes</h3>
      <div id="recurringList"></div>
    </div>

    <div class="habits" id="habitSection" style="display:none;">
      <h3>Hábitos</h3>
      <div class="habit-row" id="habitRow"></div>
    </div>

    <div class="meds" id="medSection" style="display:none;">
      <h3>Medicação</h3>
      <div id="medList"></div>
    </div>

    <div class="nutrition" id="nutriSection" style="display:none;">
      <h3>Nutrição</h3>
      <div id="nutriGroups"></div>
    </div>

    <div class="thoughts" id="thoughtSection" style="display:none;">
      <h3>Pensamentos</h3>
      <div id="thoughtList"></div>
    </div>

    <div class="reminders" id="reminderSection" style="display:none;">
      <h3>Lembretes</h3>
      <div id="reminderList"></div>
    </div>

    <div class="day-finance" id="financeSection" style="display:none;">
      <h3>Gastos e recebimentos do dia</h3>
      <div id="dfList"></div>
    </div>
  `;
  root.innerHTML = html;

  document.getElementById('dPrev').onclick=()=>{ state.day=addDays(state.day,-1); save(); renderAll(); };
  document.getElementById('dNext').onclick=()=>{ state.day=addDays(state.day,1); save(); renderAll(); };
  document.getElementById('dSettingsBtn').onclick = openDaySettingsModal;

  refreshDaySections(d, iso);
}

function openDaySettingsModal(){
  const iso = state.day;
  const d = getDaily(iso);
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>${ICONS.gear} Horário do dia</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="range-config">
      Agenda das
      <input type="number" id="dStart" min="0" max="23" value="${d.start}">
      às
      <input type="number" id="dEnd" min="1" max="24" value="${d.end}">
      h
    </div>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  document.getElementById('dStart').addEventListener('change',(e)=>{
    let v=parseInt(e.target.value,10); if(isNaN(v)) v=6;
    d.start=Math.max(0,Math.min(23,v)); save(); refreshCurrentDay();
  });
  document.getElementById('dEnd').addEventListener('change',(e)=>{
    let v=parseInt(e.target.value,10); if(isNaN(v)) v=22;
    d.end=Math.max(d.start+1,Math.min(24,v)); save(); refreshCurrentDay();
  });
}

/* ---------- atualização das seções da visão Dia ---------- */
export function refreshCurrentDay(){
  const iso = state.day;
  const d = getDaily(iso);
  refreshDaySections(d, iso);
}

export function refreshDaySections(d, iso){
  const weekStart = mondayOf(new Date(iso+'T00:00:00'));
  const weekReminders = getWeekReminders(weekStart);
  document.getElementById('dayWeekRemindersSection').style.display = weekReminders.length>0 ? '' : 'none';
  if(weekReminders.length>0) renderWeekReminderList(weekStart, 'dayWeekRemindersList');

  renderSchedule(d);

  const starred = d.tasks.some(t=>t.star) || d.todos.some(t=>t.star);
  document.getElementById('prioritySection').style.display = starred ? '' : 'none';
  if(starred) renderPriorities(d);

  document.getElementById('todoSection').style.display = d.todos.length>0 ? '' : 'none';
  if(d.todos.length>0) renderTodos(d, iso);

  const todaysRecurring = state.recurringTasks.filter(t=> isRecurringOccurrence(t, iso));
  document.getElementById('recurringSection').style.display = todaysRecurring.length>0 ? '' : 'none';
  if(todaysRecurring.length>0) renderRecurringToday(iso, todaysRecurring);

  const habitMarked = state.habits.length>0;
  document.getElementById('habitSection').style.display = habitMarked ? '' : 'none';
  if(habitMarked) renderHabits(d);

  const activeMeds = state.medications.filter(m=> medActiveOnDay(m, iso));
  const medMarked = activeMeds.length>0;
  document.getElementById('medSection').style.display = medMarked ? '' : 'none';
  if(medMarked) renderMeds(d, iso);

  const nutriHas = MEALS.some(m=> (d.nutrition[m.id]||[]).length>0);
  document.getElementById('nutriSection').style.display = nutriHas ? '' : 'none';
  if(nutriHas) renderNutrition(d);

  document.getElementById('thoughtSection').style.display = d.thoughts.length>0 ? '' : 'none';
  if(d.thoughts.length>0) renderThoughts(d);

  document.getElementById('reminderSection').style.display = d.reminders.length>0 ? '' : 'none';
  if(d.reminders.length>0) renderReminders(d);

  const dayTx = state.finance.filter(t=>t.date===iso);
  document.getElementById('financeSection').style.display = dayTx.length>0 ? '' : 'none';
  if(dayTx.length>0) renderDayFinance(iso);
}

/* ---------- prioridades (derivadas das estrelas) ---------- */
function renderPriorities(d){
  const wrap = document.getElementById('priorityList');
  const starredTasks = d.tasks.filter(t=> t.star).map(t=>({text:t.text, done:t.done, time:pad(t.start)+'h'}));
  const starredTodos = d.todos.filter(t=> t.star).map(t=>({text:t.text, done:t.done, time:null}));
  const items = starredTasks.concat(starredTodos);
  wrap.innerHTML = items.map(it=>`
    <div class="priority-chip${it.done?' done':''}">
      ${it.time?`<span class="ptime">${it.time}</span>`:''}
      <span class="ptext">${escapeHtml(it.text)}</span>
    </div>`).join('');
}

/* ---------- agenda por horário ---------- */
const ROW_H = 40;

function renderSchedule(d){
  const rail = document.getElementById('hourRail');
  const body = document.getElementById('scheduleBody');
  rail.innerHTML='';
  for(let h=d.start; h<d.end; h++){
    const el = document.createElement('div');
    el.className='hr-label';
    el.textContent = pad(h)+':00';
    rail.appendChild(el);
  }
  body.style.height = ((d.end-d.start)*ROW_H)+'px';
  body.innerHTML='';

  d.tasks
    .filter(t=> t.start < d.end && t.end > d.start)
    .forEach(t=>{
      const start = Math.max(t.start, d.start);
      const end = Math.min(t.end, d.end);
      const block = document.createElement('div');
      block.className='task-block kind-'+(t.kind||'tarefa')+(t.done?' done':'');
      block.style.top = ((start-d.start)*ROW_H + 2)+'px';
      block.style.height = Math.max((end-start)*ROW_H - 4, ROW_H-6)+'px';
      block.innerHTML = `
        <div class="task-block-inner">
          ${t.kind==='tarefa' ? `<button type="button" class="star-btn${t.star?' on':''}" title="Prioridade">★</button>` : ''}
          <input type="checkbox" ${t.done?'checked':''}>
          <input type="text" value="${escapeHtml(t.text)}">
          <span class="tb-tag">${t.kind==='evento'?'Evento':'Tarefa'}</span>
          <span class="tb-time">${pad(t.start)}–${pad(t.end)}h</span>
          <button class="tb-edit" title="Editar">${ICONS.pencil}</button>
          <button class="tb-rm" title="Excluir">${ICONS.trash}</button>
        </div>`;
      block.addEventListener('click', e=> e.stopPropagation());
      const starBtn = block.querySelector('.star-btn');
      if(starBtn){
        starBtn.addEventListener('click', ()=>{
          t.star = !t.star; save(); refreshCurrentDay();
        });
      }
      block.querySelector('input[type=checkbox]').addEventListener('change',(e)=>{
        t.done=e.target.checked; save(); refreshCurrentDay();
      });
      block.querySelector('input[type=text]').addEventListener('input',(e)=>{
        t.text=e.target.value; save();
        if(t.star){ const pl=document.getElementById('priorityList'); if(pl) renderPriorities(d); }
      });
      block.querySelector('.tb-edit').addEventListener('click',()=>{
        openEditModal(t.kind, state.day, ()=>t);
      });
      block.querySelector('.tb-rm').addEventListener('click',()=>{
        d.tasks = d.tasks.filter(x=>x.id!==t.id);
        save(); refreshCurrentDay();
      });
      body.appendChild(block);
    });

  body.onclick = (e)=>{
    const rect = body.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let hour = d.start + Math.floor(y/ROW_H);
    hour = Math.max(d.start, Math.min(d.end-1, hour));
    openAddModal(hour);
  };
}

/* ---------- tarefas sem horário ---------- */
function renderTodos(d, iso){
  const wrap = document.getElementById('todos');
  wrap.innerHTML='';
  d.todos.forEach((t,idx)=>{
    const row = document.createElement('div');
    row.className='todo-item'+(t.done?' done':'');
    row.innerHTML = `
      <button type="button" class="star-btn${t.star?' on':''}" title="Prioridade">★</button>
      <input type="checkbox" ${t.done?'checked':''}>
      <input type="text" value="${escapeHtml(t.text)}">
      <button type="button" class="time-btn" title="Atribuir horário">${ICONS.clock}</button>
      <button class="rm" title="Excluir">${ICONS.trash}</button>
    `;
    row.querySelector('.star-btn').addEventListener('click', ()=>{
      t.star = !t.star; save(); refreshCurrentDay();
    });
    row.querySelector('input[type=checkbox]').addEventListener('change',(e)=>{
      t.done=e.target.checked; save(); refreshCurrentDay();
    });
    row.querySelector('input[type=text]').addEventListener('input',(e)=>{ t.text=e.target.value; save(); });
    row.querySelector('.time-btn').addEventListener('click', ()=> openInlineTimePicker(row, d, idx));
    row.querySelector('.rm').addEventListener('click',()=>{
      d.todos.splice(idx,1); save(); refreshCurrentDay();
    });
    wrap.appendChild(row);
  });
}
function openInlineTimePicker(row, d, idx){
  const existing = row.querySelector('.inline-time');
  if(existing){ existing.remove(); return; }
  const t = d.todos[idx];
  const mini = document.createElement('div');
  mini.className='inline-time';
  mini.innerHTML = `
    <select class="itStart"></select>
    <select class="itEnd"></select>
    <button type="button" class="itOk">Confirmar</button>
  `;
  const startSel = mini.querySelector('.itStart');
  const endSel = mini.querySelector('.itEnd');
  for(let h=d.start; h<d.end; h++) startSel.innerHTML += `<option value="${h}">${pad(h)}:00</option>`;
  function refreshEnd(){
    const sv = parseInt(startSel.value,10);
    endSel.innerHTML='';
    for(let h=sv+1; h<=d.end; h++) endSel.innerHTML += `<option value="${h}">${pad(h)}:00</option>`;
  }
  refreshEnd();
  startSel.addEventListener('change', refreshEnd);
  mini.querySelector('.itOk').addEventListener('click', ()=>{
    const start = parseInt(startSel.value,10);
    const end = parseInt(endSel.value,10);
    d.todos.splice(idx,1);
    d.tasks.push({id:Date.now()+Math.random(), text:t.text, done:t.done, star:t.star, start, end, kind:'tarefa'});
    save(); refreshCurrentDay();
  });
  row.appendChild(mini);
}

/* ---------- lembretes do dia ---------- */
function renderReminders(d){
  const wrap = document.getElementById('reminderList');
  wrap.innerHTML = '';
  d.reminders.forEach(t=>{
    const row = document.createElement('div');
    row.className='thought-item reminder-item'+(t.done?' done':'');
    row.innerHTML = `<input type="checkbox" ${t.done?'checked':''}><span class="ttext">${escapeHtml(t.text)}</span><button class="edit" title="Editar">${ICONS.pencil}</button><button class="rm" title="Excluir">${ICONS.trash}</button>`;
    row.querySelector('input[type=checkbox]').addEventListener('change',(e)=>{
      t.done = e.target.checked; save(); row.classList.toggle('done', t.done);
    });
    row.querySelector('.edit').addEventListener('click', ()=>{
      openEditModal('lembrete', state.day, ()=>t);
    });
    row.querySelector('.rm').addEventListener('click', ()=>{
      d.reminders = d.reminders.filter(x=>x.id!==t.id);
      save(); refreshCurrentDay();
    });
    wrap.appendChild(row);
  });
}
