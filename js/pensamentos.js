/* =========================================================
 * ARQUIVO: js/pensamentos.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Tudo relacionado a pensamentos: a seção na visão Dia (lista
 *   simples), a página própria (cards de todos os pensamentos do mês,
 *   navegando por mês), e o modal de editar um pensamento específico.
 *
 * QUANDO É USADO
 *   renderThoughts é chamado por calendario.js na visão Dia.
 *   renderPensamentosPage é chamado por nav.js quando
 *   state.mainSection==='pensamentos'. openThoughtEditModal é aberto
 *   pelo lápis tanto na visão Dia quanto nos cards da página própria.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Seção "Pensamentos" na visão Dia (renderThoughts)
 *   2. Coleta de todos os pensamentos de um mês, buscando em todos os
 *      dias salvos (collectMonthThoughts)
 *   3. Página própria — cards por mês (renderPensamentosPage)
 *   4. Modal de editar um pensamento (openThoughtEditModal)
 * ========================================================= */

import { state, save } from './state.js';
import { todayISO, MONTH_NAMES } from './dates.js';
import { ICONS } from './icons.js';
import { escapeHtml, getDaily, showInlineWarning } from './utils.js';
import { closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- seção "Pensamentos" na visão Dia ---------- */
export function renderThoughts(d){
  const wrap = document.getElementById('thoughtList');
  wrap.innerHTML = '';
  d.thoughts.forEach(t=>{
    const row = document.createElement('div');
    row.className='thought-item';
    row.innerHTML = `<span class="tdot">·</span><span class="ttext">${escapeHtml(t.text)}</span><button class="edit" title="Editar">${ICONS.pencil}</button><button class="rm" title="Excluir">${ICONS.trash}</button>`;
    row.querySelector('.edit').addEventListener('click', ()=> openThoughtEditModal(state.day, t));
    row.querySelector('.rm').addEventListener('click', ()=>{
      d.thoughts = d.thoughts.filter(x=>x.id!==t.id);
      save(); refreshCurrentDay();
    });
    wrap.appendChild(row);
  });
}

/* ---------- coleta dos pensamentos de um mês ---------- */
function collectMonthThoughts(year, month){
  const items = [];
  Object.keys(state.daily).forEach(iso=>{
    const dt = new Date(iso+'T00:00:00');
    if(dt.getFullYear()!==year || dt.getMonth()!==month) return;
    const dd = state.daily[iso];
    if(!dd || !dd.thoughts) return;
    dd.thoughts.forEach(t=> items.push({iso, id:t.id, text:t.text}));
  });
  items.sort((a,b)=> b.iso.localeCompare(a.iso));
  return items;
}

/* ---------- página própria (cards por mês) ---------- */
export function renderPensamentosPage(root){
  const year = state.pensamentosYear, month = state.pensamentosMonth;
  root.innerHTML = `
    <div class="view-header">
      <div class="month-nav-center">
        <button class="icon-btn" id="pensPrevMonth">‹</button>
        <h2 class="view-title">${MONTH_NAMES[month]} de ${year}</h2>
        <button class="icon-btn" id="pensNextMonth">›</button>
      </div>
      <button class="today-btn" id="pensTodayBtn">Hoje</button>
    </div>
    <div class="add-row" style="margin-bottom:18px;">
      <input type="text" id="pensInlineInput" placeholder="Anotar um pensamento solto...">
      <button class="btn-primary" id="pensInlineAdd">Anotar</button>
    </div>
    <div id="pensCardsWrap"></div>
  `;
  document.getElementById('pensPrevMonth').addEventListener('click', ()=>{
    let m=month-1, y=year; if(m<0){m=11;y--;}
    state.pensamentosMonth=m; state.pensamentosYear=y; save(); renderAll();
  });
  document.getElementById('pensNextMonth').addEventListener('click', ()=>{
    let m=month+1, y=year; if(m>11){m=0;y++;}
    state.pensamentosMonth=m; state.pensamentosYear=y; save(); renderAll();
  });
  document.getElementById('pensTodayBtn').addEventListener('click', ()=>{
    const t=new Date(); state.pensamentosMonth=t.getMonth(); state.pensamentosYear=t.getFullYear();
    save(); renderAll();
  });

  const wrap = document.getElementById('pensCardsWrap');
  const items = collectMonthThoughts(year, month);
  if(items.length===0){
    wrap.innerHTML = `<p class="empty-state">Nenhum pensamento registrado neste mês.</p>`;
  } else {
    wrap.innerHTML = '';
    items.forEach(item=>{
      const dt = new Date(item.iso+'T00:00:00');
      const card = document.createElement('div');
      card.className='thought-card';
      card.innerHTML = `
        <span class="tc-date">${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]}</span>
        <p class="tc-text">${escapeHtml(item.text)}</p>
        <div class="tc-actions">
          <button class="edit" title="Editar">${ICONS.pencil}</button>
          <button class="rm" title="Excluir">${ICONS.trash}</button>
        </div>
      `;
      card.querySelector('.edit').addEventListener('click', ()=>{
        const dd = getDaily(item.iso);
        const real = dd.thoughts.find(x=>x.id===item.id);
        if(real) openThoughtEditModal(item.iso, real);
      });
      card.querySelector('.rm').addEventListener('click', ()=>{
        const dd = getDaily(item.iso);
        dd.thoughts = dd.thoughts.filter(x=>x.id!==item.id);
        save(); renderPensamentosPage(root);
      });
      wrap.appendChild(card);
    });
  }

  const addFn = ()=>{
    const inp = document.getElementById('pensInlineInput');
    const text = inp.value.trim();
    if(!text) return;
    const iso = todayISO();
    const dd = getDaily(iso);
    dd.thoughts.push({id:Date.now()+Math.random(), text});
    save();
    const dt = new Date(iso+'T00:00:00');
    if(dt.getMonth()!==state.pensamentosMonth || dt.getFullYear()!==state.pensamentosYear){
      state.pensamentosMonth = dt.getMonth(); state.pensamentosYear = dt.getFullYear();
      save();
    }
    renderPensamentosPage(root);
  };
  document.getElementById('pensInlineAdd').addEventListener('click', addFn);
  document.getElementById('pensInlineInput').addEventListener('keydown',(e)=>{ if(e.key==='Enter') addFn(); });
}

/* ---------- modal de editar um pensamento ---------- */
export function openThoughtEditModal(iso, thought){
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>Editar pensamento</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Texto <input type="text" id="thText" value="${escapeHtml(thought.text)}"></label>
    </div>
    <button class="btn-primary" id="thSaveBtn" style="margin-top:14px;">Salvar</button>
    <button type="button" class="btn-primary" id="thDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir</button>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  document.getElementById('thSaveBtn').addEventListener('click', ()=>{
    const text = document.getElementById('thText').value.trim();
    if(!text){ showInlineWarning(document.getElementById('thSaveBtn'), 'Digite um texto.'); return; }
    thought.text = text;
    save(); closeDaySettingsModal();
  });
  document.getElementById('thDeleteBtn').addEventListener('click', ()=>{
    const dd = getDaily(iso);
    dd.thoughts = dd.thoughts.filter(x=>x.id!==thought.id);
    save(); closeDaySettingsModal();
  });
}
