// inline-module-loader.js — index.html'deki tek type="module" inline <script>'ten taşındı.
// social.js (1.6MB), planning.js (480KB) ve collab.js (58KB) ilk yüklemeyi
// bloklamasın diye artık senkron <script src> ile değil, sayfa yüklendikten
// sonra sırayla (orijinal çalışma sırası korunarak: social → planning → collab)
// dinamik import() ile yükleniyor. Bu üç dosya zaten kendi init kodlarını
// document.readyState==='loading' kontrolüyle çalıştırıyor, yani geç
// yüklenmeye karşı hazırlar — bu değişiklik davranışlarını değiştirmez,
// sadece "Bugün" sekmesindeki ilk etkileşimi geciktiren indirme/parse
// yükünü öteler.
// NOT: document.createElement('script') + s.type='module' yerine gerçek
// import() kullanılıyor — Vite'ın build sırasında bu dosyaları statik
// olarak keşfedip bundle/minify edebilmesi için gerekli (createElement ile
// çalışma zamanında enjekte edilen script'leri bundler statik analizle
// göremiyordu). Hata durumunda (bir modül yüklenemezse) sıradaki modüle
// geçmeye devam eder — eski onerror davranışıyla aynı. Bu dosya index.html'de
// type="module" olarak yüklenmeli (import() kullandığı için).
(function() {
    async function start() {
        const steps = [
            () => import('./social.js'),
            () => import('./social-emoji-picker.js'),
            () => import('./social-group-focus-render.js'),
            () => import('./social-online-people-popover.js'),
            () => import('./social-assignments-badge.js'),
            () => import('./social-focus-hush.js'),
            () => import('./social-daily-race.js'),
            () => import('./social-unread-divider.js'),
            () => import('./social-chat-search.js'),
            () => import('./social-chat-clear.js'),
            () => import('./social-sidebar-profile.js'),
            () => import('./social-notif-sounds.js'),
            () => import('./social-buddy-habits.js'),
            () => import('./social-online-friends.js'),
            () => import('./social-activity-feed.js'),
            () => import('./social-roles.js'),
            () => import('./social-gamification.js'),
            () => import('./social-chat-extras.js'),
            () => import('./social-polls.js'),
            () => import('./planning-wizard-info-tooltip.js'),
            () => import('./planning-ghost-toast.js'),
            () => import('./planning.js'),
            () => import('./collab.js'),
        ];
        for (const step of steps) {
            try { await step(); } catch (e) { console.warn('[FocusAI] modül yüklenemedi:', e); }
        }
    }
    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', function() {
            if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
            else setTimeout(start, 0);
        });
    }
})();
