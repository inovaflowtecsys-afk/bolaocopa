import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl) {
      console.info(`PWA pronta: ${swUrl}`);
    },
    onOfflineReady() {
      console.info('Bolão da Copa pronto para uso offline.');
    },
  });
}
