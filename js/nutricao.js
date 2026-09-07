/* =========================================================
 * ARQUIVO: js/nutricao.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Tudo relacionado a nutrição: a lista de refeições (MEALS), a seção
 *   que aparece na visão Dia (só mostra as refeições que têm algo
 *   registrado), e a página própria de Nutrição (mesma lógica, mas com
 *   navegação por dia e um botão de adicionar por refeição).
 *
 * QUANDO É USADO
 *   MEALS e getMealItems são usados por vários módulos (calendario.js,
 *   modal.js) sempre que precisam iterar as refeições do dia.
 *   renderNutrition é chamado por calendario.js na visão Dia.
 *   renderNutricaoPage é chamado por nav.js quando
 *   state.mainSection==='nutricao'.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Lista de refeições (MEALS) e acesso aos itens de uma refeição
 *      num dia (getMealItems)
 *   2. Seção "Nutrição" na visão Dia (renderNutrition)
 *   3. Página própria de Nutrição (renderNutricaoPage)
 * ========================================================= */

import { state, save } from './state.js';
import { addDays, weekdayLabel, MONTH_NAMES } from './dates.js';
import { ICONS } from './icons.js';
import { escapeHtml, getDaily } from './utils.js';
import { openEditModal, openAddModalDirect } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- refeições ---------- */
export const MEALS = [
  {id:'cafe-manha', label:'Café da manhã'},
  {id:'almoco', label:'Almoço'},
  {id:'cafe-tarde', label:'Café da tarde'},
  {id:'lanche', label:'Lanche'},
  {id:'noite', label:'Noite'}
];
export function getMealItems(d, mealId){
  if(!d.nutrition[mealId]) d.nutrition[mealId]=[];
  return d.nutrition[mealId];
}

/* ---------- seção "Nutrição" na visão Dia ---------- */
export function renderNutrition(d){
  const wrap = document.getElementById('nutriGroups');
  wrap.innerHTML = '';
  const mealsWithItems = MEALS.filter(meal => getMealItems(d, meal.id).length>0);
  mealsWithItems.forEach(meal=>{
    const items = getMealItems(d, meal.id);
    const group = document.createElement('div');
    group.className='nutri-group';
    const itemsHtml = items.map(it=>`
          <div class="nutri-item" data-id="${it.id}">
            <span class="nutri-dot">•</span>
            <span class="nutri-text">${escapeHtml(it.text)}</span>
            <button class="nedit" title="Editar">${ICONS.pencil}</button>
            <button class="rm" title="Excluir">${ICONS.trash}</button>
          </div>`).join('');
    group.innerHTML = `<div class="nutri-group-title">${meal.label}</div>${itemsHtml}`;
    group.querySelectorAll('.nutri-item').forEach(row=>{
      const id = row.dataset.id;
      const item = items.find(i=>String(i.id)===id);
      row.querySelector('.nedit').addEventListener('click', ()=>{
        openEditModal('nutricao', state.day, ()=>item, meal.id);
      });
      row.querySelector('.rm').addEventListener('click', ()=>{
        d.nutrition[meal.id] = items.filter(i=>i!==item);
        save(); refreshCurrentDay();
      });
    });
    wrap.appendChild(group);
  });
}

/* ---------- página própria (histórico por dia) ---------- */
export function renderNutricaoPage(root){
  const iso = state.day;
  const dt = new Date(iso+'T00:00:00');
  const day = getDaily(iso);
  root.innerHTML = `
    <div class="day-view-top">
      <div class="day-nav-center">
        <button class="icon-btn" id="nutPrev">‹</button>
        <div class="day-title-block">
          <h2 class="view-title">${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]}</h2>
          <span class="weekday-label">${weekdayLabel(iso)} · ${dt.getFullYear()}</span>
        </div>
        <button class="icon-btn" id="nutNext">›</button>
      </div>
    </div>
    <div id="nutPageGroups"></div>
    <button class="btn-primary" id="nutAddBtn" style="margin-top:14px;">+ Adicionar</button>
  `;
  document.getElementById('nutPrev').addEventListener('click', ()=>{ state.day=addDays(state.day,-1); save(); renderAll(); });
  document.getElementById('nutNext').addEventListener('click', ()=>{ state.day=addDays(state.day,1); save(); renderAll(); });
  document.getElementById('nutAddBtn').addEventListener('click', ()=> openAddModalDirect('nutricao', iso));

  const wrap = document.getElementById('nutPageGroups');
  const mealsWithItems = MEALS.filter(meal => getMealItems(day, meal.id).length>0);
  if(mealsWithItems.length===0){
    wrap.innerHTML = `<p class="empty-state">Não há registros para o dia.</p>`;
    return;
  }
  wrap.innerHTML = '';
  mealsWithItems.forEach(meal=>{
    const items = getMealItems(day, meal.id);
    const group = document.createElement('div');
    group.className='nutri-group nutri-page-group';
    const itemsHtml = items.map(it=>`
      <div class="nutri-item" data-id="${it.id}">
        <span class="nutri-dot">•</span>
        <span class="nutri-text">${escapeHtml(it.text)}</span>
        <button class="nedit" title="Editar">${ICONS.pencil}</button>
        <button class="rm" title="Excluir">${ICONS.trash}</button>
      </div>`).join('');
    group.innerHTML = `
      <div class="nutri-group-title-row">
        <span class="nutri-group-title">${meal.label}</span>
        <button type="button" class="nutri-add-mini" data-meal="${meal.id}" title="Adicionar">+</button>
      </div>
      ${itemsHtml}
    `;
    group.querySelectorAll('.nutri-item').forEach(row=>{
      const id = row.dataset.id;
      const item = items.find(i=>String(i.id)===id);
      row.querySelector('.nedit').addEventListener('click', ()=> openEditModal('nutricao', iso, ()=>item, meal.id));
      row.querySelector('.rm').addEventListener('click', ()=>{
        day.nutrition[meal.id] = items.filter(i=>i!==item);
        save(); renderNutricaoPage(root);
      });
    });
    group.querySelector('.nutri-add-mini').addEventListener('click', ()=>{
      openAddModalDirect('nutricao', iso, meal.id);
    });
    wrap.appendChild(group);
  });
}
