const CACHE_NAME = 'meu-planner-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './css/base.css', './css/components.css', './css/calendario.css',
  './css/habitos.css', './css/medicamentos.css', './css/nutricao.css',
  './css/pensamentos.css', './css/financas.css', './css/tarefas.css',
  './js/dates.js', './js/state.js', './js/icons.js', './js/utils.js',
  './js/modal.js', './js/nav.js', './js/calendario.js', './js/habitos.js',
  './js/nutricao.js', './js/pensamentos.js', './js/financas.js',
  './js/tarefas.js', './js/medicamentos.js', './js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
