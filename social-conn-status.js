// social-conn-status.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, 2026-07-23):
// bağlantı durumu banner'ı (çevrimdışı/çevrimiçi bildirimi) + yeniden
// bağlanınca son açık DM/grup sohbetini tazeleme (reconnect gap-fill).
// Tamamen izole, dışarıdan hiç çağrılmıyor (sadece online/offline event
// listener'ları ve sayfa açılışındaki tek seferlik navigator.onLine kontrolü).
//
// Dış bağımlılıklar (window.* üzerinden): window._dcGetLastOpenArgs (YENİ
// getter), window.openDcDmRoom, window.openDcGroupChannelSupabase.
(function () {
'use strict';

    function _connBannerEl() {
        let el = document.getElementById('dc-conn-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dc-conn-banner';
            document.body.appendChild(el);
        }
        return el;
    }

    function _showConnBanner(text, kind) {
        const el = _connBannerEl();
        el.textContent = text;
        el.className = 'show ' + (kind || '');
        clearTimeout(el._hideTimer);
    }

    function _hideConnBanner(afterMs) {
        const el = _connBannerEl();
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.className = ''; }, afterMs || 0);
    }

    function _reconnectGapFill() {
        const lastArgs = window._dcGetLastOpenArgs();
        if (!lastArgs) return;
        try {
            if (lastArgs.fn === 'dm') window.openDcDmRoom(...lastArgs.args);
            else if (lastArgs.fn === 'group') window.openDcGroupChannelSupabase(...lastArgs.args);
        } catch (e) { console.warn('[FocusAI] reconnect gap-fill hatası', e); }
    }

    window.addEventListener('offline', () => {
        _showConnBanner('Bağlantı koptu — yeniden bağlanmayı bekliyor…', 'offline');
    });
    window.addEventListener('online', () => {
        _showConnBanner('Bağlantı yeniden kuruldu ✓', 'online');
        _hideConnBanner(2000);
        // Kısa bir gecikmeyle aç — ağ tam otursun
        setTimeout(_reconnectGapFill, 600);
    });
    // Sayfa çevrimdışı açıldıysa bandı hemen göster — ama önce doğrula: navigator.onLine
    // özellikle gömülü/önizleme tarayıcılarda gerçekte bağlantı varken de yanlışlıkla
    // false dönebiliyor. Gerçek bir ağ isteği başarılı olursa (Supabase'e ulaşabiliyorsak)
    // banner hiç gösterilmez.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setTimeout(async () => {
            try {
                await fetch('https://qyzfkiideqovqiarabds.supabase.co/auth/v1/health', { mode: 'no-cors', cache: 'no-store' });
                return; // istek gönderilebildi, gerçekten çevrimiçiyiz
            } catch (e) {
                if (navigator.onLine === false) _showConnBanner('Bağlantı yok — çevrimdışısın', 'offline');
            }
        }, 500);
    }

})();
