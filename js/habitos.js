/* =========================================================
 * ARQUIVO: js/habitos.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Tudo relacionado a hábitos: a seção que aparece na visão Dia
 *   (chips com toggle de feito/não feito), a página de gerenciamento
 *   (lista de hábitos, cada um levando pro seu detalhe), e a página de
 *   detalhe de um hábito (calendário anual mostrando os dias marcados).
 *
 * QUANDO É USADO
 *   renderHabits é chamado por calendario.js sempre que a visão Dia é
 *   redesenhada e existe pelo menos um hábito cadastrado.
 *   renderHabitsSection/renderHabitDetail são chamados por nav.js
 *   quando state.mainSection é 'habitos' ou 'habito-detail'.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Seção "Hábitos" na visão Dia (renderHabits)
 *   2. Página de gerenciamento — lista de hábitos (renderHabitsSection)
 *   3. Página de detalhe — calendário anual de um hábito
 *      (renderHabitDetail)
 * ========================================================= */

import { state, save } from './state.js';
import { todayISO, pad, daysInMonth, firstWeekdayMon, MONTH_NAMES, DOW_MINI } from './dates.js';
import { ICONS } from './icons.js';
import { getDaily, escapeHtml } from './utils.js';
import { openEditModal, openAddModalDirect } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- seção "Hábitos" na visão Dia ---------- */
export function renderHabits(d){
  const wrap = document.getElementById('habitRow');
  wrap.innerHTML = '';
  state.habits.forEach(h=>{
    const on = !!d.habitLog[h.id];
    const chip = document.createElement('div');
    chip.className='habit-chip';
    chip.innerHTML = `
      <button type="button" class="habit-dot${on?' on':''}" title="${escapeHtml(h.name)}">${on?'✓':''}</button>
      <span class="hname">${escapeHtml(h.name)}</span>
      <div class="chip-actions">
        <button type="button" class="hedit" title="Editar">${ICONS.pencil}</button>
        <button type="button" class="hrm" title="Excluir">${ICONS.trash}</button>
      </div>
    `;
    chip.querySelector('.habit-dot').addEventListener('click', ()=>{
      d.habitLog[h.id] = !d.habitLog[h.id];
      save(); refreshCurrentDay();
    });
    chip.querySelector('.hedit').addEventListener('click', ()=>{
      openEditModal('habito', state.day, ()=>h);
    });
    chip.querySelector('.hrm').addEventListener('click', ()=>{
      state.habits = state.habits.filter(x=>x.id!==h.id);
      save(); refreshCurrentDay();
    });
    wrap.appendChild(chip);
  });
}

/* ---------- página de gerenciamento ---------- */
export function renderHabitsSection(root){
  root.innerHTML = `
    <div class="view-header centered"><h2 class="view-title">Hábitos</h2></div>
    <div id="habitsListWrap"></div>
    <button class="btn-primary" id="addHabitPageBtn" style="margin-top:16px;">+ Novo hábito</button>
  `;
  const wrap = document.getElementById('habitsListWrap');
  if(state.habits.length===0){
    wrap.innerHTML = `<p class="empty-state">Nenhum hábito cadastrado ainda.</p>`;
  } else {
    wrap.innerHTML = '';
    const today = todayISO();
    state.habits.forEach(h=>{
      const dd = state.daily[today];
      const doneToday = !!(dd && dd.habitLog && dd.habitLog[h.id]);
      const row = document.createElement('button');
      row.type='button';
      row.className='habit-list-row';
      row.innerHTML = `
        <span class="hlr-dot${doneToday?' on':''}">${doneToday?'✓':''}</span>
        <span class="hlr-name">${escapeHtml(h.name)}</span>
        <span class="hlr-arrow">›</span>
      `;
      row.addEventListener('click', ()=>{
        state.mainSection='habito-detail'; state.habitDetailId=h.id;
        state.habitDetailYear = new Date().getFullYear();
        save(); renderAll();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('addHabitPageBtn').addEventListener('click', ()=>{
    openAddModalDirect('habito', todayISO());
  });
}

/* ---------- página de detalhe (calendário anual) ---------- */
export function renderHabitDetail(root){
  const h = state.habits.find(x=>x.id===state.habitDetailId);
  if(!h){ state.mainSection='habitos'; save(); renderAll(); return; }
  const year = state.habitDetailYear;
  root.innerHTML = `
    <div class="view-header">
      <button class="modal-back" id="habitBackBtn">‹ Hábitos</button>
      <div class="month-nav-center">
        <button class="icon-btn" id="hdPrevYear">‹</button>
        <h2 class="view-title">${escapeHtml(h.name)} · ${year}</h2>
        <button class="icon-btn" id="hdNextYear">›</button>
      </div>
      <button class="icon-btn" id="hdEditBtn" title="Editar">${ICONS.pencil}</button>
    </div>
    <div class="year-grid" id="habitYearGrid"></div>
  `;
  document.getElementById('habitBackBtn').addEventListener('click', ()=>{
    state.mainSection='habitos'; save(); renderAll();
  });
  document.getElementById('hdPrevYear').addEventListener('click', ()=>{ state.habitDetailYear--; save(); renderAll(); });
  document.getElementById('hdNextYear').addEventListener('click', ()=>{ state.habitDetailYear++; save(); renderAll(); });
  document.getElementById('hdEditBtn').addEventListener('click', ()=>{
    openEditModal('habito', todayISO(), ()=>h);
  });

  const grid = document.getElementById('habitYearGrid');
  grid.innerHTML='';
  for(let m=0;m<12;m++){
    const wrap = document.createElement('div');
    wrap.className='mini-month';
    const dim = daysInMonth(year, m);
    const first = firstWeekdayMon(year, m);
    let cells = '';
    DOW_MINI.forEach(d=> cells += `<span>${d}</span>`);
    for(let i=0;i<first;i++) cells += `<div class="empty"></div>`;
    for(let day=1; day<=dim; day++){
      const iso = `${year}-${pad(m+1)}-${pad(day)}`;
      const dd = state.daily[iso];
      const done = !!(dd && dd.habitLog && dd.habitLog[h.id]);
      cells += `<button type="button" class="mday${done?' habit-done':''}" data-iso="${iso}">${day}</button>`;
    }
    wrap.innerHTML = `<span class="mini-title" style="cursor:default;">${MONTH_NAMES[m]}</span><div class="mini-grid habit-mini-grid">${cells}</div>`;
    wrap.querySelectorAll('.mday').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const iso = btn.dataset.iso;
        const dd = getDaily(iso);
        dd.habitLog[h.id] = !dd.habitLog[h.id];
        save(); renderHabitDetail(root);
      });
    });
    grid.appendChild(wrap);
  }
}
