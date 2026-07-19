// inline-sw-register.js — index.html'deki Service Worker kayıt inline <script>'inden taşındı.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('FocusAI PWA hazır.'))
        .catch(e => console.warn('SW hatası:', e));
}
