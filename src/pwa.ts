import { registerSW } from 'virtual:pwa-register';

const APP_CACHE_VERSION_KEY = 'bolao-pwa-cache-version';
const APP_CACHE_VERSION = `${__APP_VERSION__}:${__BUILD_DATE__}`;

const cleanupLegacyCaches = async () => {
  if (!('caches' in window)) return;

  const previousVersion = localStorage.getItem(APP_CACHE_VERSION_KEY);
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter(cacheName =>
        cacheName === 'supabase-api' ||
        cacheName.includes('supabase') ||
        (previousVersion && previousVersion !== APP_CACHE_VERSION && cacheName.includes('precache'))
      )
      .map(cacheName => caches.delete(cacheName)),
  );

  localStorage.setItem(APP_CACHE_VERSION_KEY, APP_CACHE_VERSION);
};

if ('serviceWorker' in navigator) {
  void cleanupLegacyCaches();

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(swUrl, registration) {
      console.info(`PWA pronta: ${swUrl}`);
      void registration?.update();
    },
    onOfflineReady() {
      console.info('Bolao da Copa pronto para uso offline.');
    },
  });

  const requestServiceWorkerUpdate = () => {
    void navigator.serviceWorker.getRegistration().then(registration => registration?.update());
  };

  window.addEventListener('focus', requestServiceWorkerUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestServiceWorkerUpdate();
    }
  });
}
