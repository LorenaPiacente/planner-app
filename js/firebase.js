/* =========================================================
 * ARQUIVO: js/firebase.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Toda a integração com o Firebase: inicializa a conexão (usando as
 *   chaves de firebase-config.js), cuida do login/logout com Google,
 *   e lê/escreve os dados do app no Firestore. Cada pessoa logada tem
 *   um único documento com todo o seu `state` (o mesmo formato que já
 *   salvamos no localStorage) — não existe um documento por tarefa/
 *   hábito/etc, é uma "foto" completa, igual ao arquivo .json que a
 *   versão PWA já sabia exportar.
 *
 *   O SDK do Firebase é importado direto de um link (CDN), sem
 *   npm/build — do mesmo jeito que importamos nossos próprios módulos.
 *
 * QUANDO É USADO
 *   Importado por main.js, que usa este arquivo pra decidir se mostra
 *   a tela de login ou o app, e por state.js, que usa
 *   saveStateToCloud/loadStateFromCloud pra manter o Firestore
 *   sincronizado com o `state` em memória.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Inicialização (app, autenticação, banco) com cache local
 *      persistente ligado — o Firestore guarda uma cópia local (via
 *      IndexedDB) e sincroniza sozinho quando a internet volta
 *   2. Login com Google, logout, e o "observador" de mudança de
 *      login (onAuthChange) — usado por main.js pra saber quando
 *      mostrar a tela de login ou o app
 *   3. Ler e escrever o state no documento da pessoa logada
 * ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

/* ---------- inicialização ---------- */
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// persistentLocalCache: guarda uma cópia local (IndexedDB) dos dados do Firestore,
// então leitura/escrita continuam funcionando sem internet e sincronizam sozinhas ao voltar.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
});

/* ---------- login / logout ---------- */
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(){
  await signInWithPopup(auth, googleProvider);
}
export async function signOutUser(){
  await signOut(auth);
}
export function onAuthChange(callback){
  return onAuthStateChanged(auth, callback);
}

/* ---------- ler / escrever o state no Firestore ---------- */
export async function loadStateFromCloud(uid){
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().state : null;
}
export async function saveStateToCloud(uid, state){
  await setDoc(doc(db, 'users', uid), { state, updatedAt: Date.now() });
}
