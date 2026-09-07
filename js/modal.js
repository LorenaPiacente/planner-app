/* =========================================================
 * ARQUIVO: js/modal.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Os dois sistemas de modal genéricos usados em todo o app:
 *   (1) o "hub de adicionar" — aberto pelo botão flutuante (FAB) ou por
 *   um botão "+" específico — que mostra a grade de categorias
 *   (Evento/Tarefa/Gasto/Pensamento/Lembrete/Nutrição/Medicação/Hábito)
 *   e o formulário de cada uma; e (2) o "modal de configurações"
 *   (#settingsModalOverlay), uma folha genérica que cada área usa pro
 *   seu próprio conteúdo (editar entrada financeira, editar remédio,
 *   escolher horário do dia, etc) — este arquivo só define como ela
 *   abre/fecha, o conteúdo de dentro é responsabilidade de quem a abre.
 *
 * QUANDO É USADO
 *   Importado por qualquer módulo que precise abrir um modal — ou seja,
 *   quase todos. openAddModal/openAddModalDirect/openEditModal são os
 *   pontos de entrada do hub; closeDaySettingsModal é o fechamento
 *   genérico do modal de configurações (mesmo o nome sugerindo "do dia",
 *   ele é reaproveitado por todas as áreas — o nome ficou assim porque
 *   foi o primeiro uso, na configuração do horário do dia).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Categorias do hub de adicionar e estado do modal em memória
 *      (qual categoria, editando o quê, em qual dia)
 *   2. Abrir/fechar o hub (openAddModal, openAddModalDirect,
 *      openEditModal, closeAddModal)
 *   3. Tela de escolha de categoria (renderModalCategories)
 *   4. Formulário de cada categoria (renderModalSubform) — a peça
 *      central: monta o HTML e conecta os eventos de salvar, por
 *      categoria (evento/tarefa, gasto, pensamento, lembrete,
 *      nutrição, medicação, hábito)
 *   5. Marcação rápida dentro do formulário de Medicação/Hábito
 *      (renderModalMedQuickMark, renderModalHabitQuickMark)
 *   6. Fechamento genérico do modal de configurações
 *      (closeDaySettingsModal) — usado por praticamente toda área
 * ========================================================= */

import { state, save } from './state.js';
import { getDaily, escapeHtml, attachMoneyMask, moneyInputValue, showInlineWarning } from './utils.js';
import { pad, fmtLongDate } from './dates.js';
import { ICONS } from './icons.js';
import { renderAll } from './nav.js';
import { recurrenceConfigHtml, wireRecurrenceConfig, readRecurrenceConfig } from './tarefas.js';
import { MEALS, getMealItems } from './nutricao.js';
import { medActiveOnDay, medDoseTimes, getMedDoseArr, medTag } from './medicamentos.js';

/* ---------- categorias + estado do modal ---------- */
export const CATEGORIES = [
  {id:'evento', icon: ICONS.calendar, label:'Evento'},
  {id:'tarefa', icon: ICONS.checkSquare, label:'Tarefa'},
  {id:'gasto', icon: ICONS.wallet, label:'Gasto'},
  {id:'pensamento', icon: ICONS.bubble, label:'Pensamento'},
  {id:'lembrete', icon: ICONS.pin, label:'Lembrete'},
  {id:'nutricao', icon: ICONS.utensils, label:'Nutrição'},
  {id:'medicacao', icon: ICONS.pill, label:'Medicação'},
  {id:'habito', icon: ICONS.repeat, label:'Hábito'}
];
let pendingStartHour = null;
let modalTargetDay = null;
let editingContext = null; // {cat, get:()=>item, mealId?}
let pendingMealId = null;

/* ---------- abrir / fechar ---------- */
export function openAddModal(presetHour, targetDay){
  pendingStartHour = (typeof presetHour==='number') ? presetHour : null;
  modalTargetDay = targetDay || null;
  pendingMealId = null;
  editingContext = null;
  document.getElementById('addModalOverlay').classList.add('show');
  renderModalCategories();
}
export function openAddModalDirect(cat, targetDay, mealId){
  pendingStartHour = null;
  modalTargetDay = targetDay || null;
  pendingMealId = mealId || null;
  editingContext = null;
  document.getElementById('addModalOverlay').classList.add('show');
  renderModalSubform(cat);
}
export function openEditModal(cat, targetDay, getItemFn, mealId){
  pendingStartHour = null;
  modalTargetDay = targetDay || null;
  pendingMealId = null;
  editingContext = { cat, get:getItemFn, mealId };
  document.getElementById('addModalOverlay').classList.add('show');
  renderModalSubform(cat);
}
export function closeAddModal(){
  document.getElementById('addModalOverlay').classList.remove('show');
  pendingStartHour = null;
  modalTargetDay = null;
  pendingMealId = null;
  editingContext = null;
  renderAll();
}

/* ---------- escolha de categoria ---------- */
function renderModalCategories(){
  editingContext = null;
  const sheet = document.getElementById('modalSheet');
  const dateNote = modalTargetDay && modalTargetDay!==state.day
    ? `<p class="schedule-hint" style="text-align:center;margin-bottom:10px;">Adicionando em ${fmtLongDate(modalTargetDay)}</p>` : '';
  sheet.innerHTML = `
    <div class="modal-header"><h3>Adicionar</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
    ${dateNote}
    <div class="cat-grid">
      ${CATEGORIES.map(c=>`<button type="button" class="cat-btn" data-cat="${c.id}"><span class="cat-icon">${c.icon}</span>${c.label}</button>`).join('')}
    </div>
  `;
  sheet.querySelector('#modalCloseBtn').addEventListener('click', closeAddModal);
  sheet.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> renderModalSubform(btn.dataset.cat));
  });
}

/* ---------- formulário de cada categoria ---------- */
function renderModalSubform(cat){
  const iso = modalTargetDay || state.day;
  const d = getDaily(iso);
  const sheet = document.getElementById('modalSheet');
  const catDef = CATEGORIES.find(c=>c.id===cat);
  const editing = (editingContext && editingContext.cat===cat) ? editingContext.get() : null;
  let bodyHtml = '';

  if(cat==='evento' || cat==='tarefa'){
    const isTimed = editing && editing.start!==undefined;
    bodyHtml = `
      <input type="text" id="mText" value="${editing?escapeHtml(editing.text):''}" placeholder="${cat==='evento' ? 'Nome do evento' : 'O que precisa ser feito?'}" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:.85rem;margin-bottom:10px;">
      ${cat==='tarefa' ? `<label class="link-toggle" id="mLinkTimeRow" ${!editing?'':'style="display:none;"'}><input type="checkbox" id="mLinkTime" ${isTimed?'checked':''}> vincular a um horário</label>` : ''}
      <div class="time-pickers ${(cat==='evento'||isTimed)?'show':''}" id="mTimePickers">
        <label>Início <select id="mStart"></select></label>
        <label>Até <select id="mEnd"></select></label>
      </div>
      ${cat==='tarefa' && !editing ? `
      <label class="link-toggle" id="mRecurringRow"><input type="checkbox" id="mRecurring"> tornar recorrente</label>
      <div id="mRecurringFields" style="display:none;">
        ${recurrenceConfigHtml('mRec', null)}
      </div>` : ''}
      <button class="btn-primary" id="mSubmit" style="margin-top:10px;">${editing?'Salvar':'Adicionar'}</button>
    `;
  } else if(cat==='gasto'){
    bodyHtml = `
      <div class="df-form">
        <input type="text" id="mDesc" placeholder="Descrição">
        <select id="mType"><option value="out">Saída</option><option value="in">Entrada</option></select>
        <input type="text" inputmode="decimal" id="mValue" class="money-input" placeholder="0,00">
      </div>
      <button class="btn-primary" id="mSubmit">Lançar</button>
    `;
  } else if(cat==='pensamento'){
    bodyHtml = `
      <input type="text" id="mText" placeholder="Anotar um pensamento solto..." style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:.85rem;margin-bottom:10px;">
      <button class="btn-primary" id="mSubmit">Anotar</button>
    `;
  } else if(cat==='lembrete'){
    bodyHtml = `
      <input type="text" id="mText" value="${editing?escapeHtml(editing.text):''}" placeholder="O que você precisa lembrar?" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:.85rem;margin-bottom:10px;">
      <button class="btn-primary" id="mSubmit">${editing?'Salvar':'Adicionar'}</button>
    `;
  } else if(cat==='nutricao'){
    bodyHtml = `
      <div class="nutri-add-form show">
        <select id="mMeal">${MEALS.map(m=>`<option value="${m.id}" ${(editing && editingContext.mealId===m.id) || (!editing && pendingMealId===m.id) ?'selected':''}>${m.label}</option>`).join('')}</select>
        <input type="text" id="mFood" value="${editing?escapeHtml(editing.text):''}" placeholder="O que você comeu?">
      </div>
      <button class="btn-primary" id="mSubmit" style="margin-top:10px;">${editing?'Salvar':'Adicionar'}</button>
    `;
  } else if(cat==='medicacao'){
    const activeMeds = state.medications.filter(m=> medActiveOnDay(m, iso));
    bodyHtml = `
      ${!editing && activeMeds.length>0 ? `<div id="medQuickMark"></div><p class="schedule-hint">Ou cadastre um novo remédio:</p>` : ''}
      <input type="text" id="newMedName" value="${editing?escapeHtml(editing.name):''}" placeholder="Nome do remédio" style="width:100%;margin-bottom:8px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font-size:.8rem;">
      <div class="med-add" style="margin-top:0;">
        <label>Tipo
          <select id="newMedType">
            <option value="continuo" ${!editing||editing.doseType==='continuo'?'selected':''}>Uso contínuo</option>
            <option value="ciclo" ${editing&&editing.doseType==='ciclo'?'selected':''}>Ciclo (dias)</option>
            <option value="unica" ${editing&&editing.doseType==='unica'?'selected':''}>Dose única</option>
          </select>
        </label>
        <label>Doses/dia <input type="number" id="newMedDoses" min="1" max="6" value="${editing?editing.dosesPerDay:1}"></label>
        <label id="medIntervalWrap">Intervalo (h) <input type="number" id="newMedInterval" min="1" max="24" value="${editing?editing.intervalHours:24}"></label>
        <label>1ª dose <input type="time" id="newMedStart" value="${editing?editing.startTime:'08:00'}"></label>
        <label id="medDaysWrap" style="display:${editing&&editing.doseType==='ciclo'?'':'none'};">Duração (dias) <input type="number" id="newMedDays" min="1" max="90" value="${editing&&editing.totalDays?editing.totalDays:7}"></label>
        <label>Início <input type="date" id="newMedDate" value="${editing?editing.startDate:iso}"></label>
      </div>
      <button class="btn-primary" id="mSubmit" style="margin-top:10px;">${editing?'Salvar':'+ cadastrar remédio'}</button>
    `;
  } else if(cat==='habito'){
    bodyHtml = `
      ${!editing && state.habits.length>0 ? `<div class="habit-row" id="habitQuickMark"></div><p class="schedule-hint">Ou crie um novo hábito:</p>` : ''}
      <div class="habit-add" style="margin-top:0;">
        <input type="text" id="newHabit" value="${editing?escapeHtml(editing.name):''}" placeholder="Novo hábito (ex: água, alongamento...)">
        <button class="btn-primary" id="mSubmit">${editing?'Salvar':'+ hábito'}</button>
      </div>
    `;
  }

  sheet.innerHTML = `
    <div class="modal-header">
      ${editing ? '<span style="width:52px;"></span>' : `<button class="modal-back" id="modalBackBtn">‹ voltar</button>`}
      <h3>${catDef.icon} ${editing?'Editar ':''}${catDef.label}</h3>
      <button class="modal-close" id="modalCloseBtn">✕</button>
    </div>
    ${bodyHtml}
  `;
  if(!editing) sheet.querySelector('#modalBackBtn').addEventListener('click', renderModalCategories);
  sheet.querySelector('#modalCloseBtn').addEventListener('click', closeAddModal);

  if(cat==='evento' || cat==='tarefa'){
    const startSel = document.getElementById('mStart');
    const endSel = document.getElementById('mEnd');
    for(let h=d.start; h<d.end; h++) startSel.innerHTML += `<option value="${h}">${pad(h)}:00</option>`;
    function refreshEnd(){
      const sv = parseInt(startSel.value,10);
      endSel.innerHTML='';
      for(let h=sv+1; h<=d.end; h++) endSel.innerHTML += `<option value="${h}">${pad(h)}:00</option>`;
    }
    const isTimed = editing && editing.start!==undefined;
    if(isTimed && editing.start>=d.start && editing.start<d.end){
      startSel.value = String(editing.start);
      refreshEnd();
      if(editing.end<=d.end) endSel.value = String(editing.end);
    } else if(pendingStartHour!==null && pendingStartHour>=d.start && pendingStartHour<d.end){
      startSel.value = String(pendingStartHour);
      if(cat==='tarefa'){
        document.getElementById('mLinkTime').checked = true;
        document.getElementById('mTimePickers').classList.add('show');
      }
      refreshEnd();
    } else {
      refreshEnd();
    }
    startSel.addEventListener('change', refreshEnd);

    if(cat==='tarefa'){
      const linkCk = document.getElementById('mLinkTime');
      linkCk.addEventListener('change', ()=>{
        document.getElementById('mTimePickers').classList.toggle('show', linkCk.checked);
      });
    }

    if(cat==='tarefa' && !editing){
      const recCk = document.getElementById('mRecurring');
      const linkRow = document.getElementById('mLinkTimeRow');
      const recFields = document.getElementById('mRecurringFields');
      recCk.addEventListener('change', ()=>{
        recFields.style.display = recCk.checked ? '' : 'none';
        linkRow.style.display = recCk.checked ? 'none' : '';
        if(recCk.checked){
          document.getElementById('mLinkTime').checked = false;
          document.getElementById('mTimePickers').classList.remove('show');
        }
      });
      wireRecurrenceConfig('mRec');
    }

    document.getElementById('mSubmit').onclick = ()=>{
      const text = document.getElementById('mText').value.trim();
      if(!text) return;
      if(cat==='tarefa' && !editing && document.getElementById('mRecurring').checked){
        const cfg = readRecurrenceConfig('mRec', document.getElementById('mSubmit'));
        if(!cfg) return;
        state.recurringTasks.push({
          id:Date.now()+Math.random(), text, kind:cfg.kind, startDate:iso, endDate:null,
          weekdays:cfg.weekdays, monthDays:cfg.monthDays, intervalN:cfg.intervalN, intervalUnit:cfg.intervalUnit,
          completions:{}
        });
        save(); closeAddModal();
        return;
      }
      if(cat==='evento'){
        const start = parseInt(startSel.value,10), end = parseInt(endSel.value,10);
        if(editing){ editing.text=text; editing.start=start; editing.end=end; }
        else d.tasks.push({id:Date.now()+Math.random(), text, done:false, star:false, start, end, kind:'evento'});
      } else {
        const linked = document.getElementById('mLinkTime').checked;
        if(linked){
          const start = parseInt(startSel.value,10), end = parseInt(endSel.value,10);
          if(editing && editing.start!==undefined){
            editing.text=text; editing.start=start; editing.end=end;
          } else if(editing){
            const idx = d.todos.indexOf(editing);
            if(idx>-1) d.todos.splice(idx,1);
            d.tasks.push({id:Date.now()+Math.random(), text, done:editing.done||false, star:editing.star||false, start, end, kind:'tarefa'});
          } else {
            d.tasks.push({id:Date.now()+Math.random(), text, done:false, star:false, start, end, kind:'tarefa'});
          }
        } else {
          if(editing && editing.start!==undefined){
            d.tasks = d.tasks.filter(x=>x!==editing);
            d.todos.push({text, done:editing.done||false, star:editing.star||false});
          } else if(editing){
            editing.text = text;
          } else {
            d.todos.push({text, done:false, star:false});
          }
        }
      }
      save(); closeAddModal();
    };
  } else if(cat==='gasto'){
    attachMoneyMask(document.getElementById('mValue'));
    document.getElementById('mSubmit').onclick = ()=>{
      const desc = document.getElementById('mDesc').value.trim();
      const type = document.getElementById('mType').value;
      const value = moneyInputValue(document.getElementById('mValue'));
      if(!desc || isNaN(value) || value<=0){ showInlineWarning(document.getElementById('mSubmit'), 'Preencha descrição e um valor válido.'); return; }
      state.finance.push({id:Date.now()+Math.random(), date:iso, desc, type, value});
      save(); closeAddModal();
    };
  } else if(cat==='pensamento'){
    document.getElementById('mSubmit').onclick = ()=>{
      const text = document.getElementById('mText').value.trim();
      if(!text) return;
      d.thoughts.push({id:Date.now()+Math.random(), text});
      save(); closeAddModal();
    };
  } else if(cat==='lembrete'){
    document.getElementById('mSubmit').onclick = ()=>{
      const text = document.getElementById('mText').value.trim();
      if(!text) return;
      if(editing) editing.text = text;
      else d.reminders.push({id:Date.now()+Math.random(), text, done:false});
      save(); closeAddModal();
    };
  } else if(cat==='nutricao'){
    document.getElementById('mSubmit').onclick = ()=>{
      const mealId = document.getElementById('mMeal').value;
      const text = document.getElementById('mFood').value.trim();
      if(!text) return;
      if(editing){
        const oldMealId = editingContext.mealId;
        if(mealId===oldMealId){
          editing.text = text;
        } else {
          d.nutrition[oldMealId] = (d.nutrition[oldMealId]||[]).filter(x=>x!==editing);
          editing.text = text;
          getMealItems(d, mealId).push(editing);
        }
      } else {
        getMealItems(d, mealId).push({id:Date.now()+Math.random(), text});
      }
      save(); closeAddModal();
    };
  } else if(cat==='medicacao'){
    if(document.getElementById('medQuickMark')) renderModalMedQuickMark(d, iso);

    const typeSel = document.getElementById('newMedType');
    const dosesInp = document.getElementById('newMedDoses');
    const intervalWrap = document.getElementById('medIntervalWrap');
    const daysWrap = document.getElementById('medDaysWrap');
    function syncVis(){
      const type = typeSel.value;
      if(type==='unica'){ dosesInp.value='1'; dosesInp.disabled=true; intervalWrap.style.display='none'; daysWrap.style.display='none'; }
      else { dosesInp.disabled=false; intervalWrap.style.display=(parseInt(dosesInp.value,10)||1)>1?'':'none'; daysWrap.style.display= type==='ciclo'?'':'none'; }
    }
    typeSel.addEventListener('change', syncVis);
    dosesInp.addEventListener('input', syncVis);
    syncVis();

    document.getElementById('mSubmit').onclick = ()=>{
      const name = document.getElementById('newMedName').value.trim();
      if(!name) return;
      const type = typeSel.value;
      let doses = parseInt(dosesInp.value,10); if(isNaN(doses)||doses<1) doses=1; if(doses>6) doses=6;
      if(type==='unica') doses=1;
      const startTime = document.getElementById('newMedStart').value || '08:00';
      let interval = parseInt(document.getElementById('newMedInterval').value,10);
      if(isNaN(interval)||interval<1) interval=Math.round(24/doses)||24;
      const startDate = document.getElementById('newMedDate').value || iso;
      let totalDays;
      if(type==='ciclo'){
        totalDays = parseInt(document.getElementById('newMedDays').value,10);
        if(isNaN(totalDays)||totalDays<1) totalDays=7;
      }
      if(editing){
        editing.name=name; editing.doseType=type; editing.dosesPerDay=doses;
        editing.startTime=startTime; editing.intervalHours=interval; editing.startDate=startDate;
        if(type==='ciclo') editing.totalDays=totalDays; else delete editing.totalDays;
      } else {
        const med = {id:Date.now()+Math.random(), name, doseType:type, dosesPerDay:doses, startTime, intervalHours:interval, startDate};
        if(type==='ciclo') med.totalDays=totalDays;
        state.medications.push(med);
      }
      save(); closeAddModal();
    };
  } else if(cat==='habito'){
    if(document.getElementById('habitQuickMark')) renderModalHabitQuickMark(d);

    document.getElementById('mSubmit').onclick = ()=>{
      const inp = document.getElementById('newHabit');
      const name = inp.value.trim();
      if(!name) return;
      if(editing) editing.name = name;
      else state.habits.push({id:Date.now()+Math.random(), name});
      save(); closeAddModal();
    };
  }
}

/* ---------- marcação rápida (dentro do formulário de Medicação / Hábito) ---------- */
function renderModalMedQuickMark(d, iso){
  const wrap = document.getElementById('medQuickMark');
  const activeMeds = state.medications.filter(m=> medActiveOnDay(m, iso));
  wrap.innerHTML = activeMeds.map(med=>{
    const doses = getMedDoseArr(d, med);
    const times = medDoseTimes(med, iso);
    const chips = doses.slice(0, times.length).map((on,i)=>`
      <div class="dose-chip">
        <span class="dose-time">${times[i]}</span>
        <button type="button" class="dose-dot${on?' on':''}" data-med="${med.id}" data-i="${i}">${on?'✓':''}</button>
      </div>`).join('');
    return `<div class="med-item"><div class="med-item-top"><span class="med-name">${escapeHtml(med.name)}</span><span class="med-tag">${medTag(med, iso)}</span></div><div class="med-doses">${chips}</div></div>`;
  }).join('');
  wrap.querySelectorAll('.dose-dot').forEach(dot=>{
    dot.addEventListener('click', ()=>{
      const medId = dot.dataset.med;
      const med = state.medications.find(m=>String(m.id)===medId);
      const doses = getMedDoseArr(d, med);
      const i = parseInt(dot.dataset.i,10);
      doses[i] = !doses[i];
      save();
      renderModalMedQuickMark(d, iso);
    });
  });
}
function renderModalHabitQuickMark(d){
  const wrap = document.getElementById('habitQuickMark');
  wrap.innerHTML = state.habits.map(h=>{
    const on = !!d.habitLog[h.id];
    return `<div class="habit-chip"><button type="button" class="habit-dot${on?' on':''}" data-h="${h.id}">${on?'✓':''}</button><span class="hname">${escapeHtml(h.name)}</span></div>`;
  }).join('');
  wrap.querySelectorAll('.habit-dot').forEach(dot=>{
    dot.addEventListener('click', ()=>{
      const hid = dot.dataset.h;
      const h = state.habits.find(x=>String(x.id)===hid);
      d.habitLog[h.id] = !d.habitLog[h.id];
      save();
      renderModalHabitQuickMark(d);
    });
  });
}

/* ---------- fechamento genérico do modal de configurações ---------- */
export function closeDaySettingsModal(){
  document.getElementById('settingsModalOverlay').classList.remove('show');
  renderAll();
}
