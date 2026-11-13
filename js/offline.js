import {t} from './i18n.js';
export async function initOffline() {
  const status = document.getElementById('offline-status');
  const install = document.getElementById('install-app');
  let ready = false, failed = false, supported = 'serviceWorker' in navigator && window.isSecureContext;
  let installEvent = null;
  const render = () => {
    status.textContent = t(!supported ? 'offlineUnsupported' : ready
      ? (navigator.onLine ? 'offlineReady' : 'offlineActive')
      : !navigator.onLine ? 'offlineNotReady' : failed ? 'offlineUnavailable' : 'offlinePreparing');
    status.dataset.ready = String(ready);
    install.textContent = t('install');
  };
  document.addEventListener('languagechange', render);
  window.addEventListener('online', render); window.addEventListener('offline', render);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  install.addEventListener('click', async () => {
    if (installEvent) { await installEvent.prompt(); installEvent = null; }
    else document.getElementById('install-help').classList.toggle('hidden');
  });
  render();
  if (!supported) return;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'OFFLINE_READY') { ready = true; failed = false; render(); }
    if (event.data?.type === 'OFFLINE_NOT_READY') { ready = false; failed = true; render(); }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => navigator.serviceWorker.controller?.postMessage({type:'CHECK_OFFLINE'}));
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const checkWorker = worker => {
      if (!worker) return;
      worker.postMessage({type:'CHECK_OFFLINE'});
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') worker.postMessage({type:'CHECK_OFFLINE'});
        if (worker.state === 'redundant') { failed = true; render(); }
      });
    };
    checkWorker(registration.active); checkWorker(registration.installing); checkWorker(registration.waiting);
    registration.addEventListener('updatefound', () => checkWorker(registration.installing));
  } catch { failed = true; render(); }
}
