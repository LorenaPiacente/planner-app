/* =========================================================
 * ARQUIVO: js/firebase-config.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   As chaves de configuração do projeto Firebase (Lola-Planner-app).
 *   Não são um segredo — identificam o projeto, não dão acesso a
 *   nada sozinhas (quem protege os dados são as regras do Firestore
 *   + a exigência de login). Ficam num arquivo separado só pra ficar
 *   fácil de achar/trocar se um dia você criar outro projeto Firebase.
 *
 * QUANDO É USADO
 *   Importado uma única vez, por js/firebase.js, pra inicializar a
 *   conexão com o Firebase.
 * ========================================================= */

export const firebaseConfig = {
  apiKey: "AIzaSyCDuz4ZzfcHuLJV0MeuUbEWgycTF8Ligh4",
  authDomain: "lola-planner-app.firebaseapp.com",
  projectId: "lola-planner-app",
  storageBucket: "lola-planner-app.firebasestorage.app",
  messagingSenderId: "898284929533",
  appId: "1:898284929533:web:b6f6d21fe1701c47de5994"
};
