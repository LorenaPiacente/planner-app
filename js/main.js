/* =========================================================
 * ARQUIVO: js/main.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   O ponto de entrada do app. Não define nenhuma função de área —
 *   só importa tudo que precisa rodar uma única vez ao carregar a
 *   página: o controle de login (mostrar a tela de entrar ou o app),
 *   a migração de formato antigo dos remédios, os cliques que só
 *   existem uma vez na tela (navegação principal, FAB, fechar modal
 *   clicando fora, o botão de arquivo de dados), o registro do
 *   service worker (PWA), e a primeira renderização.
 *
 * QUANDO É USADO
 *   Carregado por último no index.html (depois de todos os outros
 *   módulos, via <script type="module" src="js/main.js">). É o único
 *   arquivo que referencia elementos do DOM que existem uma vez só
 *   (não recriados a cada renderização).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Login: observa se a pessoa está logada e mostra a tela de
 *      entrar ou o app; ao logar, sincroniza com a nuvem e migra
 *      dados antigos de remédios antes de desenhar a tela pela
 *      primeira vez
 *   2. Clique na navegação principal (troca de área + reset de
 *      mês/dia quando aplicável)
 *   3. Botão flutuante (FAB) e fechar modais clicando fora
 *   4. Botão do arquivo de dados + banner de reconexão
 *   5. Registro do service worker (funcionamento offline)
 * ========================================================= */

import { state, save, FS_SUPPORTED, openFileModal, manualReconnectFile, tryAutoReconnectFile, syncOnLogin, clearCurrentUser } from './state.js';
import { todayISO } from './dates.js';
import { svgIcon } from './icons.js';
import { openAddModal, closeAddModal, closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import { ensureMedsShape } from './medicamentos.js';
import { onAuthChange, signInWithGoogle, signOutUser } from './firebase.js';

/* ---------- login ---------- */
document.getElementById('googleSignInBtn').addEventListener('click', ()=>{
  signInWithGoogle().catch(e=> console.error('Falha ao entrar', e));
});
document.getElementById('signOutBtn').addEventListener('click', ()=>{
  signOutUser().catch(e=> console.error('Falha ao sair', e));
});

onAuthChange(async (user)=>{
  const loginScreen = document.getElementById('loginScreen');
  const appShell = document.getElementById('appShell');
  if(user){
    loginScreen.classList.remove('show');
    appShell.style.display = '';
    document.getElementById('userEmailLabel').textContent = user.email || '';
    await syncOnLogin(user.uid);
    ensureMedsShape();
    renderAll();
    tryAutoReconnectFile();
  } else {
    clearCurrentUser();
    appShell.style.display = 'none';
    loginScreen.classList.add('show');
  }
});

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
