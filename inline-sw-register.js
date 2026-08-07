// inline-sw-register.js — index.html'deki Service Worker kayıt inline <script>'inden taşındı.
// Yerel geliştirmede (npm run dev / localhost) SW KAYDEDİLMEZ: SW'nin
// stale-while-revalidate fetch handler'ı .js/.css/.html isteklerini önbellek-
// öncelikli sunuyor — bu, Vite dev server'ın anında yansıması gereken kaynak
// değişikliklerini bayat gösterip "düzeltme uygulanmadı" izlenimi veriyordu
// (kullanıcı raporu, 2026-08-06). SW sadece gerçek deploy/prod build'de
// (localhost olmayan host) devreye girsin — orada PWA offline desteği için gerekli.
const _isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
if ('serviceWorker' in navigator && !_isLocalDev) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('FocusAI PWA hazır.'))
        .catch(e => console.warn('SW hatası:', e));
} else if (_isLocalDev && 'serviceWorker' in navigator) {
    // Önceki bir oturumdan kayıtlı kalmış olabilecek SW'leri de temizle ki
    // eski kayıt hâlâ fetch'leri önbellekten sunmaya devam etmesin.
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
