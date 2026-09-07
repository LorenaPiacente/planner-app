/* =========================================================
 * ARQUIVO: js/state.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   O "banco de dados" do app. Define o formato inicial do objeto `state`
 *   (todas as áreas: calendário, hábitos, nutrição, financeiro, tarefas
 *   recorrentes, remédios...), carrega esse objeto do localStorage ao
 *   abrir o app, e salva nele a cada mudança. Também cuida da conexão
 *   com um arquivo .json real no disco (File System Access API), que é
 *   a forma de ter uma cópia portátil e editável dos dados, além do
 *   localStorage.
 *
 * QUANDO É USADO
 *   Importado por praticamente todo módulo do app — é a base de tudo.
 *   `state` é a variável compartilhada que guarda todos os dados em
 *   memória; `save()` é chamado depois de qualquer mudança nela.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Estado: chave de storage, formato inicial (loadState), variável
 *      `state`, e save() (grava no localStorage + no arquivo conectado)
 *   2. Arquivo de dados (File System Access API): abrir/criar/desconectar
 *      um arquivo .json real, IndexedDB só pra lembrar qual arquivo foi
 *      escolhido da última vez, e a reconexão automática ao abrir o app
 * ========================================================= */

import { ICONS } from './icons.js';
import { renderAll } from './nav.js';
import { closeDaySettingsModal } from './modal.js';
import { ensureMedsShape } from './medicamentos.js';
import { todayISO, mondayOf } from './dates.js';

/* ---------- estado ---------- */
export const STORAGE_KEY = 'meuPlanner:v1';

export function loadState(){
  let raw = null;
  try{ raw = localStorage.getItem(STORAGE_KEY); }catch(e){}
  const base = {
    view:'diario',
    year:new Date().getFullYear(),
    month:new Date().getMonth(), // 0-11
    day: todayISO(),
    weekStart: mondayOf(new Date()),
    monthlyNotes:{},   // iso -> string
    daily:{},          // iso -> {start,end,priorities,todos,tasks,thoughts,reminders,habitLog}
    finance:[],        // {id,date,desc,type,value}
    habits:[],         // {id,name}
    medications:[],    // {id,name,dosesPerDay}
    weekShow:{tasks:true, habits:false, meds:false, meals:false, expenses:false, thoughts:false, reminders:false},
    weeklyReminders:{},  // weekStartIso -> [{id,text,done}]
    mainSection:'calendario',
    habitDetailId:null,
    habitDetailYear:new Date().getFullYear(),
    cards:[],           // {id,name,bank,closingDay,dueDay}
    cardPurchases:[],   // {id,cardId,desc,totalValue,purchaseDate,installments,category,essential}
    financeCategories:[
      {id:'alimentacao', name:'Alimentação'},
      {id:'transporte', name:'Transporte'},
      {id:'moradia', name:'Moradia'},
      {id:'saude', name:'Saúde'},
      {id:'lazer', name:'Lazer'},
      {id:'compras', name:'Compras'},
      {id:'educacao', name:'Educação'},
      {id:'assinaturas', name:'Assinaturas'},
      {id:'outros', name:'Outros'}
    ],
    financeSubView:'resumo',
    financeMonth:new Date().getMonth(),
    financeYear:new Date().getFullYear(),
    cardDetailId:null,
    cardDetailYear:new Date().getFullYear(),
    cardDetailMonth:new Date().getMonth(),
    pensamentosMonth:new Date().getMonth(),
    pensamentosYear:new Date().getFullYear(),
    medsMonth:new Date().getMonth(),
    medsYear:new Date().getFullYear(),
    recurringTasks:[]  // {id,text,star,kind:'interval'|'weekdays'|'monthdays',intervalDays,weekdays,monthDays,startDate,endDate,completions:{iso:true}}
  };
  if(!raw) return base;
  try{
    const parsed = JSON.parse(raw);
    if(parsed.weekShow) parsed.weekShow = Object.assign({}, base.weekShow, parsed.weekShow);
    return Object.assign(base, parsed);
  }catch(e){ return base; }
}

export let state = loadState();

export function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ console.error('Falha ao salvar', e); }
  if(dataFileHandle){ writeStateToFile(); }
}

/* ---------- arquivo de dados (File System Access API) ---------- */
export const FS_SUPPORTED = 'showSaveFilePicker' in window;
export let dataFileHandle = null;

const IDB_NAME = 'plannerFileDB';
const IDB_STORE = 'handles';
function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = ()=> req.result.createObjectStore(IDB_STORE);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbSet(key, val){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbDelete(key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}

async function writeStateToFile(){
  if(!dataFileHandle) return;
  try{
    const writable = await dataFileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
  }catch(e){ console.error('Falha ao gravar no arquivo', e); }
}
async function loadStateFromFile(){
  if(!dataFileHandle) return;
  try{
    const file = await dataFileHandle.getFile();
    const text = await file.text();
    if(text.trim()){
      const parsed = JSON.parse(text);
      const base = loadState();
      state = Object.assign(base, parsed);
      if(state.weekShow) state.weekShow = Object.assign({}, base.weekShow, state.weekShow);
      ensureMedsShape();
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
    }
  }catch(e){ console.error('Falha ao ler o arquivo', e); }
}
export async function connectNewDataFile(){
  try{
    const handle = await window.showSaveFilePicker({
      suggestedName: 'meu-planner-dados.json',
      types: [{ description:'JSON', accept:{'application/json':['.json']} }]
    });
    dataFileHandle = handle;
    await idbSet('dataFile', handle);
    await writeStateToFile();
    updateFileStatusUI();
  }catch(e){ if(e.name!=='AbortError') console.error(e); }
}
export async function connectExistingDataFile(){
  try{
    const [handle] = await window.showOpenFilePicker({
      types: [{ description:'JSON', accept:{'application/json':['.json']} }]
    });
    const perm = await handle.requestPermission({mode:'readwrite'});
    if(perm!=='granted') return;
    dataFileHandle = handle;
    await idbSet('dataFile', handle);
    await loadStateFromFile();
    renderAll();
    updateFileStatusUI();
  }catch(e){ if(e.name!=='AbortError') console.error(e); }
}
export function disconnectDataFile(){
  dataFileHandle = null;
  idbDelete('dataFile');
  updateFileStatusUI();
}
export async function tryAutoReconnectFile(){
  if(!FS_SUPPORTED) return;
  try{
    const handle = await idbGet('dataFile');
    if(!handle) return;
    const perm = await handle.queryPermission({mode:'readwrite'});
    if(perm==='granted'){
      dataFileHandle = handle;
      await loadStateFromFile();
      renderAll();
      updateFileStatusUI();
    } else {
      dataFileHandle = handle;
      document.getElementById('reconnectBanner').classList.add('show');
    }
  }catch(e){ /* handle inválido ou permissão negada permanentemente: ignora */ }
}
export async function manualReconnectFile(){
  if(!dataFileHandle) return;
  try{
    const perm = await dataFileHandle.requestPermission({mode:'readwrite'});
    if(perm==='granted'){
      await loadStateFromFile();
      document.getElementById('reconnectBanner').classList.remove('show');
      renderAll();
      updateFileStatusUI();
    }
  }catch(e){ console.error(e); }
}
function updateFileStatusUI(){
  const btn = document.getElementById('fileStatusBtn');
  if(!btn) return;
  btn.classList.toggle('connected', !!dataFileHandle);
  btn.title = dataFileHandle ? 'Arquivo de dados conectado' : 'Arquivo de dados';
}
export function openFileModal(){
  const sheet = document.getElementById('settingsSheet');
  const connected = !!dataFileHandle;
  sheet.innerHTML = `
    <div class="modal-header"><h3>${ICONS.folder} Arquivo de dados</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <p class="schedule-hint" style="margin-bottom:14px;">
      ${connected
        ? 'Seus dados estão sendo salvos automaticamente neste arquivo, além do navegador.'
        : 'Por padrão, seus dados ficam só neste navegador. Conecte um arquivo .json pra ter uma cópia de verdade, editável e portátil.'}
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn-primary" id="fileNewBtn">Criar novo arquivo</button>
      <button class="btn-primary" id="fileOpenBtn">Abrir arquivo existente</button>
      ${connected ? `<button class="btn-primary" id="fileDisconnectBtn" style="background:var(--rose);">Desconectar</button>` : ''}
    </div>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  document.getElementById('fileNewBtn').addEventListener('click', async ()=>{ await connectNewDataFile(); closeDaySettingsModal(); });
  document.getElementById('fileOpenBtn').addEventListener('click', async ()=>{ await connectExistingDataFile(); closeDaySettingsModal(); });
  const dcBtn = document.getElementById('fileDisconnectBtn');
  if(dcBtn) dcBtn.addEventListener('click', ()=>{ disconnectDataFile(); closeDaySettingsModal(); });
}
