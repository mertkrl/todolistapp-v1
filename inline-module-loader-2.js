// inline-module-loader-2.js — Faz (performans, kurulum gerektirmeyen code-splitting).
// script.js'in ~57 statik companion modülünden 5'i buraya taşındı, aynı
// inline-module-loader.js deseniyle (window.load + requestIdleCallback sonrası
// sırayla dynamic import()). Bu 5 dosya SEÇİLİRKEN sıkı bir güvenlik kriteri
// uygulandı — sadece şunlar taşındı:
//   1. DOMContentLoaded'a bağımlı DEĞİL (deferred import DOMContentLoaded'dan
//      SONRA çalışır, guard'sız bir DOMContentLoaded listener'ı asla tetiklenmez).
//   2. window.* export'ları script.js'in İLK RENDER zincirinde (renderTasks/
//      renderGoals/renderCalendar/renderStatistics/renderMindDumps gibi sayfa
//      açılır açılmaz çalışan fonksiyonlar) senkron ÇAĞRILMIYOR — sadece
//      kullanıcı etkileşimiyle (buton tıklaması, Ctrl+K, vb.) tetikleniyor.
//   3. index.html'de onclick="" gibi doğrudan HTML-inline referansları yok
//      (repo'da hiç onclick="" kullanılmıyor, tüm bağlama addEventListener ile).
//
// script.js'in geri kalan ~50 companion dosyası (script-goal-modal.js,
// script-calendar-month-view.js/week-day-view.js, script-mind-dump.js,
// script-statistics.js, script-color-utils.js, script-habit-sync.js, vb.)
// BİLİNÇLİ OLARAK BURAYA ALINMADI — grep ile doğrulandı ki bunların
// window.renderX/getXColor gibi export'ları script.js'in İLK BOYAMA
// zincirinde (sayfa açılır açılmaz çalışan render çağrılarında) senkron
// kullanılıyor. Bunları da geciktirmek "Bugün" sekmesinin ilk açılışında
// boş/renksiz görünmesi gibi GERÇEK bir regresyona yol açardı — bu,
// social.js/planning.js'in (ayrı, geç-kullanılan sekmeler olduğu için güvenle
// ertelenen) durumundan temelde farklı bir risk sınıfı.
(function() {
    async function start() {
        const steps = [
            () => import('./script-timer-flame.js'),
            () => import('./script-quick-add.js'),
            () => import('./script-spotlight-search.js'),
            () => import('./script-command-palette.js'),
            () => import('./script-plan-wizard.js'),
        ];
        for (const step of steps) {
            try { await step(); } catch (e) { console.warn('[FocusAI] modül yüklenemedi (loader-2):', e); }
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
