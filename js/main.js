/* =========================================================
 * ARQUIVO: js/main.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   O ponto de entrada do app. Não define nenhuma função de área —
 *   só importa tudo que precisa rodar uma única vez ao carregar a
 *   página: a migração de formato antigo dos remédios, os cliques que
 *   só existem uma vez na tela (navegação principal, FAB, fechar
 *   modal clicando fora, o botão de arquivo de dados), o registro do
 *   service worker (PWA), e a primeira renderização.
 *
 * QUANDO É USADO
 *   Carregado por último no index.html (depois de todos os outros
 *   módulos, via <script type="module" src="js/main.js">). É o único
 *   arquivo que referencia elementos do DOM que existem uma vez só
 *   (não recriados a cada renderização).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Migração de dados antigos (remédios)
 *   2. Clique na navegação principal (troca de área + reset de
 *      mês/dia quando aplicável)
 *   3. Botão flutuante (FAB) e fechar modais clicando fora
 *   4. Botão do arquivo de dados + banner de reconexão
 *   5. Registro do service worker (funcionamento offline)
 *   6. Primeira renderização e tentativa de reconexão automática do
 *      arquivo de dados
 * ========================================================= */

import { state, save, FS_SUPPORTED, openFileModal, manualReconnectFile, tryAutoReconnectFile } from './state.js';
import { todayISO } from './dates.js';
import { svgIcon } from './icons.js';
import { openAddModal, closeAddModal, closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import { ensureMedsShape } from './medicamentos.js';

/* ---------- migração de dados antigos ---------- */
ensureMedsShape();

/* ---------- navegação principal ---------- */
document.querySelectorAll('.snav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const section = btn.dataset.section;
    state.mainSection = section;
    if(section==='calendario'){ state.view='diario'; state.day=todayISO(); }
    else if(section==='nutricao'){ state.day=todayISO(); }
    else if(section==='pensamentos'){
      const t=new Date(); state.pensamentosMonth=t.getMonth(); state.pensamentosYear=t.getFullYear();
    }
    else if(section==='medicamentos'){
      const t=new Date(); state.medsMonth=t.getMonth(); state.medsYear=t.getFullYear();
    }
    save(); renderAll();
  });
});

/* ---------- FAB e fechar modais clicando fora ---------- */
document.getElementById('fabAdd').addEventListener('click', ()=> openAddModal());
document.getElementById('addModalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='addModalOverlay') closeAddModal();
});
document.getElementById('settingsModalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='settingsModalOverlay') closeDaySettingsModal();
});

/* ---------- arquivo de dados ---------- */
document.getElementById('fileStatusBtn').innerHTML = svgIcon('folder');
if(FS_SUPPORTED){
  document.getElementById('fileStatusBtn').addEventListener('click', openFileModal);
} else {
  document.getElementById('fileStatusBtn').style.display = 'none';
}
document.getElementById('reconnectBtn').addEventListener('click', manualReconnectFile);

/* ---------- service worker (PWA offline) ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Falha ao registrar service worker', e));
  });
}

/* ---------- partida ---------- */
renderAll();
tryAutoReconnectFile();
