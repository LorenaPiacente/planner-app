/* =========================================================
 * ARQUIVO: js/utils.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Funções auxiliares usadas por várias áreas do app: acesso aos dados
 *   de um dia específico (com migração automática de formatos antigos),
 *   formatação de texto/dinheiro, e três pecinhas de UI genéricas que
 *   não pertencem a nenhuma área em particular (aviso inline, seletor
 *   customizado, máscara de valor monetário).
 *
 * QUANDO É USADO
 *   Importado por praticamente todo módulo de área (calendário, hábitos,
 *   nutrição, financeiro, tarefas, medicamentos) e pelo modal.js.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Texto: escapeHtml
 *   2. Dados do dia: getDaily (com migração de formatos antigos),
 *      dayHasData, dayItemCount
 *   3. Aviso inline (substitui o alert() nativo, que falha em alguns
 *      contextos de preview/iframe)
 *   4. Dinheiro: fmtMoney (exibição), moneyInputFmt/attachMoneyMask/
 *      moneyInputValue (máscara nos campos de digitação)
 *   5. Seletor customizado (createCustomSelect) — substitui o <select>
 *      nativo do navegador por um dropdown com a estética do app
 * ========================================================= */

import { state } from './state.js';

/* ---------- texto ---------- */
export function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------- dados do dia ---------- */
export function getDaily(iso){
  if(!state.daily[iso]) state.daily[iso] = {start:6,end:22,priorities:['','',''],todos:[],tasks:[],thoughts:[],reminders:[],habitLog:{},medLog:{},nutrition:{}};
  const d = state.daily[iso];
  if(d.start===undefined) d.start=6;
  if(d.end===undefined) d.end=22;
  if(!d.priorities) d.priorities=['','',''];
  if(!d.todos) d.todos=[];
  if(!d.tasks) d.tasks=[];
  if(!d.thoughts) d.thoughts=[];
  if(!d.reminders) d.reminders=[];
  if(!d.habitLog) d.habitLog={};
  if(!d.medLog) d.medLog={};
  if(!d.nutrition) d.nutrition={};
  d.tasks.forEach(t=>{ if(!t.kind) t.kind='tarefa'; if(t.star===undefined) t.star=false; });
  d.todos.forEach(t=>{ if(t.star===undefined) t.star=false; });
  // migração: versões antigas guardavam um texto solto por hora (d.slots)
  if(d.slots){
    Object.keys(d.slots).forEach(h=>{
      const txt = d.slots[h];
      if(txt && txt.trim()){
        const hour = parseInt(h,10);
        d.tasks.push({id:Date.now()+Math.random(), text:txt, done:false, start:hour, end:hour+1, kind:'tarefa'});
      }
    });
    delete d.slots;
  }
  // migração: campo único "notas" vira o primeiro pensamento
  if(d.notes && d.notes.trim()){
    d.thoughts.push({id:Date.now()+Math.random(), text:d.notes.trim()});
    delete d.notes;
  } else if(d.notes!==undefined){
    delete d.notes;
  }
  return d;
}
export function dayHasData(iso){
  if(state.monthlyNotes[iso] && state.monthlyNotes[iso].trim()) return true;
  const d = state.daily[iso];
  if(d){
    if(d.todos && d.todos.length) return true;
    if(d.tasks && d.tasks.length) return true;
    if(d.thoughts && d.thoughts.length) return true;
    if(d.reminders && d.reminders.length) return true;
    if(d.habitLog && Object.values(d.habitLog).some(Boolean)) return true;
    if(d.medLog && Object.values(d.medLog).some(arr=> Array.isArray(arr) && arr.some(Boolean))) return true;
    if(d.nutrition && Object.values(d.nutrition).some(arr=> Array.isArray(arr) && arr.length>0)) return true;
    if(d.priorities && d.priorities.some(p=>p && p.trim())) return true;
  }
  return false;
}
export function dayItemCount(iso){
  let count = 0;
  if(state.monthlyNotes[iso] && state.monthlyNotes[iso].trim()) count++;
  const d = state.daily[iso];
  if(d){
    if(d.todos) count += d.todos.length;
    if(d.tasks) count += d.tasks.length;
    if(d.thoughts) count += d.thoughts.length;
    if(d.reminders) count += d.reminders.length;
    if(d.habitLog) count += Object.values(d.habitLog).filter(Boolean).length;
    if(d.medLog) count += Object.values(d.medLog).reduce((s,arr)=> s + (Array.isArray(arr) ? arr.filter(Boolean).length : 0), 0);
    if(d.nutrition) count += Object.values(d.nutrition).reduce((s,arr)=> s + (Array.isArray(arr) ? arr.length : 0), 0);
  }
  count += state.finance.filter(t=>t.date===iso).length;
  return count;
}

/* ---------- aviso inline ---------- */
export function showInlineWarning(afterEl, message){
  if(!afterEl) return;
  let warn = afterEl.nextElementSibling;
  if(!warn || !warn.classList.contains('inline-warn')){
    warn = document.createElement('div');
    warn.className = 'inline-warn';
    afterEl.insertAdjacentElement('afterend', warn);
  }
  warn.textContent = message;
  warn.classList.add('show');
  clearTimeout(warn._hideTimer);
  warn._hideTimer = setTimeout(()=> warn.classList.remove('show'), 3500);
}

/* ---------- dinheiro ---------- */
export function fmtMoney(v){
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
export function moneyInputFmt(num){
  if(num===undefined||num===null||isNaN(num)) return '';
  const cents = Math.round(Math.abs(num)*100);
  let digits = String(cents);
  while(digits.length<3) digits = '0'+digits;
  const centsStr = digits.slice(-2);
  let intPart = digits.slice(0,-2).replace(/^0+(?=\d)/,'');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (num<0?'-':'') + intPart + ',' + centsStr;
}
export function attachMoneyMask(input){
  if(!input) return;
  input.setAttribute('inputmode','decimal');
  input.addEventListener('input', ()=>{
    let digits = input.value.replace(/\D/g,'');
    if(digits===''){ input.value=''; return; }
    digits = digits.replace(/^0+(?=\d)/,'');
    while(digits.length<3) digits = '0'+digits;
    const centsStr = digits.slice(-2);
    let intPart = digits.slice(0,-2).replace(/^0+(?=\d)/,'');
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = intPart + ',' + centsStr;
  });
}
export function moneyInputValue(input){
  if(!input) return NaN;
  const digits = (input.value||'').replace(/\D/g,'');
  if(!digits) return NaN;
  return parseInt(digits,10)/100;
}

/* ---------- seletor customizado (substitui <select> nativo) ---------- */
export function createCustomSelect({options, value, onChange, placeholder}){
  const wrap = document.createElement('div');
  wrap.className = 'csel';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'csel-trigger';
  const valueSpan = document.createElement('span');
  valueSpan.className = 'csel-value';
  const arrow = document.createElement('span');
  arrow.className = 'csel-arrow';
  arrow.textContent = '▾';
  trigger.appendChild(valueSpan);
  trigger.appendChild(arrow);
  const menu = document.createElement('div');
  menu.className = 'csel-menu';

  let currentValue = value;
  let currentOptions = options;

  function labelFor(v){
    const opt = currentOptions.find(o=>String(o.value)===String(v));
    return opt ? opt.label : (placeholder||'');
  }
  function renderMenu(){
    menu.innerHTML='';
    currentOptions.forEach(o=>{
      const btn = document.createElement('button');
      btn.type='button';
      btn.className = 'csel-option' + (String(o.value)===String(currentValue)?' selected':'') + (o.action?' csel-action':'');
      btn.textContent = o.label;
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(o.action){
          closeMenu();
          o.action();
          return;
        }
        currentValue = o.value;
        valueSpan.textContent = labelFor(currentValue);
        closeMenu();
        if(onChange) onChange(currentValue);
      });
      menu.appendChild(btn);
    });
  }
  function openMenu(){ renderMenu(); wrap.classList.add('open'); setTimeout(()=>document.addEventListener('click', onDocClick),0); }
  function closeMenu(){ wrap.classList.remove('open'); document.removeEventListener('click', onDocClick); }
  function onDocClick(e){ if(!wrap.contains(e.target)) closeMenu(); }
  trigger.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(wrap.classList.contains('open')) closeMenu(); else openMenu();
  });
  valueSpan.textContent = labelFor(currentValue);
  wrap.appendChild(trigger);
  wrap.appendChild(menu);
  return {
    el: wrap,
    getValue: ()=>currentValue,
    setValue: (v)=>{ currentValue=v; valueSpan.textContent=labelFor(v); },
    setOptions: (opts, newValue)=>{ currentOptions=opts; if(newValue!==undefined) currentValue=newValue; valueSpan.textContent=labelFor(currentValue); }
  };
}
