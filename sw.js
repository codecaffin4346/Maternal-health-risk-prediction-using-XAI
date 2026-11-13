// Increment RELEASE whenever a shipped shell asset changes.
const RELEASE = 'v3';
const PREFIX = 'maternai-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + RELEASE;
const FILES = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/model.js', './js/charts.js', './js/assessment.js',
  './js/i18n.js', './js/guided.js', './js/offline.js', './js/evidence.js',
  './reports/model-evidence.json', './reports/model-evidence.md',
  './vendor/chart.umd.min.js', './vendor/jspdf.umd.min.js',
  './manifest.webmanifest', './icons/app.svg', './icons/app-192.png', './icons/app-512.png',
];
const shellUrls = FILES.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Readiness is reported only after every required local asset is cached.
    await cache.addAll(shellUrls.map(url => new Request(url, {cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
    for (const client of await self.clients.matchAll()) client.postMessage({type:'OFFLINE_READY'});
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(shellUrls.map(url => cache.match(url)))).every(Boolean);
    event.source?.postMessage({type:complete ? 'OFFLINE_READY' : 'OFFLINE_NOT_READY'});
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only the explicit app shell is cached. Health records, external requests,
  // training files and arbitrary URLs never enter this cache.
  url.search = ''; url.hash = '';
  if (!shellUrls.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.href) || fetch(event.request);
  })());
});
