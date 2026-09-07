/* =========================================================
 * ARQUIVO: js/nav.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   A navegação principal do app — a barra lateral (desktop/tablet) ou
 *   inferior (mobile) com as 7 áreas, e as abas Ano/Mês/Semana/Dia do
 *   calendário — e o roteador central (renderAll) que decide o que
 *   desenhar na tela com base em `state.mainSection` e `state.view`.
 *
 * QUANDO É USADO
 *   renderAll é a função mais chamada de todo o app — qualquer mudança
 *   de dado termina com `save(); renderAll();` pra atualizar a tela.
 *   Importado por todo módulo que precisa re-renderizar depois de uma
 *   mudança (ou seja, todos).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Lista das 4 abas do calendário (VIEWS)
 *   2. Abas do calendário + faixa de meses (renderNav)
 *   3. Barra de navegação principal — só destaca o item ativo
 *      (renderSideNav; o clique que troca de área é conectado uma
 *      única vez em main.js, não aqui)
 *   4. Roteador central (renderAll) — decide, a partir de
 *      state.mainSection e state.view, qual página desenhar
 * ========================================================= */

import { state, save } from './state.js';
import { todayISO, mondayOf, MONTH_SHORT } from './dates.js';
import { svgIcon } from './icons.js';
import { renderYear, renderMonth, renderWeek, renderDay, firstWeekStartOfMonth } from './calendario.js';
import { renderHabitsSection, renderHabitDetail } from './habitos.js';
import { renderNutricaoPage } from './nutricao.js';
import { renderPensamentosPage } from './pensamentos.js';
import { renderFinance } from './financas.js';
import { renderTarefasPage } from './tarefas.js';
import { renderMedicamentosPage } from './medicamentos.js';

/* ---------- abas do calendário ---------- */
export const VIEWS = [
  {id:'ano', label:'Ano'},
  {id:'mensal', label:'Mês'},
  {id:'semanal', label:'Semana'},
  {id:'diario', label:'Dia'}
];

function renderNav(){
  const nav = document.getElementById('mainNav');
  nav.innerHTML = VIEWS.map(v=>
    `<button class="nav-btn ${state.view===v.id?'active':''}" data-view="${v.id}">${v.label}</button>`
  ).join('');
  nav.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.view = btn.dataset.view;
      if(btn.dataset.view==='diario') state.day = todayISO();
      if(btn.dataset.view==='semanal') state.weekStart = mondayOf(new Date());
      if(btn.dataset.view==='mensal'){ const t=new Date(); state.year=t.getFullYear(); state.month=t.getMonth(); }
      save(); renderAll();
    });
  });

  const strip = document.getElementById('monthStrip');
  strip.style.display = (state.view==='diario' || state.view==='ano' || state.view==='mensal') ? 'none' : '';
  strip.innerHTML = MONTH_SHORT.map((m,i)=>
    `<button class="month-chip ${state.month===i && state.view!=='ano' ? 'active':''}" data-m="${i}">${m}</button>`
  ).join('');
  strip.querySelectorAll('.month-chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.month = parseInt(btn.dataset.m,10);
      if(state.view==='semanal'){
        state.weekStart = firstWeekStartOfMonth(state.year, state.month);
      } else if(state.view==='ano'){
        state.view='mensal';
      }
      save(); renderAll();
    });
  });
}

/* ---------- barra de navegação principal ---------- */
export function renderSideNav(){
  document.querySelectorAll('.snav-icon').forEach(el=>{
    if(!el.dataset.rendered){ el.innerHTML = svgIcon(el.dataset.icon); el.dataset.rendered='1'; }
  });
  document.querySelectorAll('.snav-btn').forEach(btn=>{
    btn.classList.toggle('active', state.mainSection===btn.dataset.section);
  });
}

/* ---------- roteador central ---------- */
export function renderAll(){
  const root = document.getElementById('viewRoot');
  renderSideNav();

  if(state.mainSection==='calendario'){
    document.getElementById('mainNav').style.display = '';
    document.querySelector('.app-subtitle').style.display = '';
    document.querySelector('.pauta').style.display = '';
    renderNav();
    root.innerHTML='';
    if(state.view==='ano') renderYear(root);
    else if(state.view==='mensal') renderMonth(root);
    else if(state.view==='semanal') renderWeek(root);
    else renderDay(root);
  } else {
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('monthStrip').style.display = 'none';
    document.querySelector('.app-subtitle').style.display = 'none';
    document.querySelector('.pauta').style.display = 'none';
    root.innerHTML='';
    if(state.mainSection==='habitos') renderHabitsSection(root);
    else if(state.mainSection==='habito-detail') renderHabitDetail(root);
    else if(state.mainSection==='nutricao') renderNutricaoPage(root);
    else if(state.mainSection==='pensamentos') renderPensamentosPage(root);
    else if(state.mainSection==='financeiro') renderFinance(root);
    else if(state.mainSection==='tarefas') renderTarefasPage(root);
    else if(state.mainSection==='medicamentos') renderMedicamentosPage(root);
  }
  document.getElementById('fabAdd').classList.toggle('show', state.mainSection==='calendario' && state.view==='diario');
}
