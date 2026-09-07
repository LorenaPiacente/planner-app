/* =========================================================
 * ARQUIVO: js/medicamentos.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Tudo relacionado a remédios: migração de formato antigo
 *   (ensureMedsShape), cálculo de horários de dose e se o remédio está
 *   ativo num dia, a seção na visão Dia (chips de dose por horário), e
 *   a página própria de Medicamentos (um card por remédio, por mês,
 *   com mini-calendário de adesão).
 *
 * QUANDO É USADO
 *   ensureMedsShape é chamado uma vez, ao iniciar o app (em main.js),
 *   pra garantir que remédios salvos num formato antigo ganhem os
 *   campos que faltam. renderMeds é chamado por calendario.js na visão
 *   Dia. renderMedicamentosPage é chamado por nav.js quando
 *   state.mainSection==='medicamentos'.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Migração de formato antigo (ensureMedsShape)
 *   2. Cálculo de horários de dose e se o remédio está ativo num dia
 *      (medDoseTimes, medActiveOnDay, medTag, getMedDoseArr)
 *   3. Seção "Medicação" na visão Dia (renderMeds)
 *   4. Status de adesão de um dia e etiqueta do tipo — usados só pela
 *      página própria (medDayStatus, medTypeLabel)
 *   5. Página própria de Medicamentos (renderMedicamentosPage)
 * ========================================================= */

import { state, save } from './state.js';
import {
  todayISO, addDays, daysInMonth, firstWeekdayMon, pad,
  timeToMinutes, minutesToHHMM, daysBetween, MONTH_NAMES, DOW_MINI
} from './dates.js';
import { ICONS } from './icons.js';
import { escapeHtml } from './utils.js';
import { openEditModal, openAddModalDirect } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- migração de formato antigo ---------- */
export function ensureMedsShape(){
  state.medications.forEach(m=>{
    if(!m.doseType) m.doseType='continuo';
    if(!m.dosesPerDay) m.dosesPerDay=1;
    if(!m.startTime) m.startTime='08:00';
    if(!m.intervalHours) m.intervalHours = m.dosesPerDay>1 ? Math.round(24/m.dosesPerDay) : 24;
    if(!m.startDate) m.startDate = todayISO();
    if(m.doseType==='unica') m.dosesPerDay=1;
    if(m.doseType==='ciclo' && !m.totalDays) m.totalDays=7;
  });
}

/* ---------- horários de dose e atividade ---------- */
export function medDoseTimes(med, iso){
  const startMin = timeToMinutes(med.startTime);
  const intervalMin = (med.dosesPerDay>1 ? (med.intervalHours || Math.round(24/med.dosesPerDay)) : 24) * 60;
  if(iso===med.startDate){
    const times=[];
    for(let i=0;i<med.dosesPerDay;i++){
      const abs = startMin + i*intervalMin;
      if(abs>=1440) break;
      times.push(minutesToHHMM(abs));
    }
    return times;
  }
  const set = new Set();
  for(let i=0;i<med.dosesPerDay;i++){
    set.add((((startMin + i*intervalMin) % 1440)+1440)%1440);
  }
  return Array.from(set).sort((a,b)=>a-b).map(minutesToHHMM);
}
export function medActiveOnDay(med, iso){
  if(iso < med.startDate) return false;
  if(med.doseType==='unica') return iso===med.startDate;
  if(med.doseType==='ciclo'){
    const endDate = addDays(med.startDate, (med.totalDays||1)-1);
    return iso<=endDate;
  }
  return true; // uso contínuo
}
export function medTag(med, iso){
  if(med.doseType==='unica') return 'dose única';
  if(med.doseType==='ciclo'){
    const dayIdx = daysBetween(med.startDate, iso)+1;
    return `ciclo · dia ${dayIdx}/${med.totalDays}`;
  }
  return 'uso contínuo';
}
export function getMedDoseArr(d, med){
  if(!d.medLog[med.id]) d.medLog[med.id] = [];
  const arr = d.medLog[med.id];
  while(arr.length < med.dosesPerDay) arr.push(false);
  if(arr.length > med.dosesPerDay) arr.length = med.dosesPerDay;
  return arr;
}

/* ---------- seção "Medicação" na visão Dia ---------- */
export function renderMeds(d, iso){
  const wrap = document.getElementById('medList');
  const activeMeds = state.medications.filter(m=> medActiveOnDay(m, iso));
  wrap.innerHTML = '';
  activeMeds.forEach(med=>{
    const doses = getMedDoseArr(d, med);
    const times = medDoseTimes(med, iso);
    const row = document.createElement('div');
    row.className='med-item';
    const chipsHtml = doses.slice(0, times.length).map((on,i)=>`
      <div class="dose-chip">
        <span class="dose-time">${times[i]}</span>
        <button type="button" class="dose-dot${on?' on':''}" data-i="${i}" title="Dose ${i+1}">${on?'✓':''}</button>
      </div>`).join('');
    row.innerHTML = `
      <div class="med-item-top">
        <span class="med-name">${escapeHtml(med.name)}</span>
        <span class="med-tag">${medTag(med, iso)}</span>
        <button type="button" class="med-edit" title="Editar">${ICONS.pencil}</button>
        <button type="button" class="med-rm" title="Excluir">${ICONS.trash}</button>
      </div>
      <div class="med-doses">${chipsHtml}</div>
    `;
    row.querySelector('.med-edit').addEventListener('click', ()=>{
      openEditModal('medicacao', iso, ()=>med);
    });
    row.querySelectorAll('.dose-dot').forEach(dot=>{
      dot.addEventListener('click', ()=>{
        const i = parseInt(dot.dataset.i,10);
        doses[i] = !doses[i];
        save(); refreshCurrentDay();
      });
    });
    row.querySelector('.med-rm').addEventListener('click', ()=>{
      state.medications = state.medications.filter(m=>m.id!==med.id);
      save(); refreshCurrentDay();
    });
    wrap.appendChild(row);
  });
}

/* ---------- status de adesão (usado só na página própria) ---------- */
function medDayStatus(med, iso){
  if(!medActiveOnDay(med, iso)) return null;
  const times = medDoseTimes(med, iso);
  if(times.length===0) return 'none';
  const dd = state.daily[iso];
  const arr = (dd && dd.medLog && dd.medLog[med.id]) || [];
  const takenCount = arr.slice(0, times.length).filter(Boolean).length;
  if(takenCount===0) return 'none';
  if(takenCount>=times.length) return 'full';
  return 'partial';
}
function medTypeLabel(med){
  if(med.doseType==='unica') return 'dose única';
  if(med.doseType==='ciclo') return `ciclo · ${med.totalDays} dias`;
  return 'uso contínuo';
}

/* ---------- página própria de Medicamentos ---------- */
export function renderMedicamentosPage(root){
  const year = state.medsYear, month = state.medsMonth;
  root.innerHTML = `
    <div class="view-header">
      <div class="month-nav-center">
        <button class="icon-btn" id="medsPrevMonth">‹</button>
        <h2 class="view-title">${MONTH_NAMES[month]} de ${year}</h2>
        <button class="icon-btn" id="medsNextMonth">›</button>
      </div>
      <button class="today-btn" id="medsTodayBtn">Hoje</button>
    </div>
    <div id="medsCardsWrap"></div>
    <button class="btn-primary" id="medsAddBtn" style="margin-top:14px;">+ Novo remédio</button>
  `;
  document.getElementById('medsPrevMonth').addEventListener('click', ()=>{
    let m=month-1,y=year; if(m<0){m=11;y--;}
    state.medsMonth=m; state.medsYear=y; save(); renderAll();
  });
  document.getElementById('medsNextMonth').addEventListener('click', ()=>{
    let m=month+1,y=year; if(m>11){m=0;y++;}
    state.medsMonth=m; state.medsYear=y; save(); renderAll();
  });
  document.getElementById('medsTodayBtn').addEventListener('click', ()=>{
    const t=new Date(); state.medsMonth=t.getMonth(); state.medsYear=t.getFullYear();
    save(); renderAll();
  });
  document.getElementById('medsAddBtn').addEventListener('click', ()=> openAddModalDirect('medicacao', todayISO()));

  const wrap = document.getElementById('medsCardsWrap');
  const dim = daysInMonth(year, month);
  const activeMeds = state.medications.filter(med=>{
    for(let day=1; day<=dim; day++){
      if(medActiveOnDay(med, `${year}-${pad(month+1)}-${pad(day)}`)) return true;
    }
    return false;
  });
  if(activeMeds.length===0){
    wrap.innerHTML = `<p class="empty-state">Nenhuma medicação neste mês.</p>`;
    return;
  }
  wrap.innerHTML = '';
  const first = firstWeekdayMon(year, month);
  activeMeds.forEach(med=>{
    const card = document.createElement('div');
    card.className = 'med-month-card';
    let cells = '';
    let gridClass = 'mini-grid med-mini-grid';
    if(med.doseType==='ciclo'){
      gridClass = 'med-linear-grid';
      for(let day=1; day<=dim; day++){
        const iso = `${year}-${pad(month+1)}-${pad(day)}`;
        const status = medDayStatus(med, iso);
        if(status===null) continue;
        const dowLetter = DOW_MINI[(new Date(iso+'T00:00:00').getDay()+6)%7];
        cells += `
          <div class="med-linear-item">
            <span class="mli-dow">${dowLetter}</span>
            <button type="button" class="mday med-${status}" data-iso="${iso}">${day}</button>
            <span class="mli-date">${pad(day)}/${pad(month+1)}</span>
          </div>`;
      }
    } else {
      DOW_MINI.forEach(d=> cells += `<span>${d}</span>`);
      for(let i=0;i<first;i++) cells += `<div class="empty"></div>`;
      for(let day=1; day<=dim; day++){
        const iso = `${year}-${pad(month+1)}-${pad(day)}`;
        const status = medDayStatus(med, iso);
        if(status===null){
          cells += `<div class="empty"></div>`;
        } else {
          cells += `<button type="button" class="mday med-${status}" data-iso="${iso}">${day}</button>`;
        }
      }
    }
    card.innerHTML = `
      <div class="med-month-header">
        <span class="med-name">${escapeHtml(med.name)}</span>
        <span class="med-tag">${medTypeLabel(med)}</span>
        <button type="button" class="edit" title="Editar">${ICONS.pencil}</button>
        <button type="button" class="rm" title="Excluir">${ICONS.trash}</button>
      </div>
      <div class="${gridClass}">${cells}</div>
    `;
    card.querySelector('.edit').addEventListener('click', ()=> openEditModal('medicacao', todayISO(), ()=>med));
    card.querySelector('.rm').addEventListener('click', ()=>{
      state.medications = state.medications.filter(m=>m.id!==med.id);
      save(); renderAll();
    });
    card.querySelectorAll('.mday').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        state.day = btn.dataset.iso; state.mainSection='calendario'; state.view='diario';
        save(); renderAll();
      });
    });
    wrap.appendChild(card);
  });
}
