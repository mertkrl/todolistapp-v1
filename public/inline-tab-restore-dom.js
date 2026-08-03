// inline-tab-restore-dom.js — index.html'deki 3. inline <script>'ten taşındı.
// ══ ERKEN SEKME RESTORASYONU (faz 2) ══
// script.js ağdan (SW no-store) inene kadar HTML'deki varsayılan "Bugün"
// aktif vurgusu ekranda kalıp sonra kayıtlı sekmeye animasyonla atlıyordu.
// Bu blok harici script beklemeden, ilk boyamadan önce doğru sekmeyi
// işaretler. index.html'de section markup'ından hemen sonra, senkron
// (type="module" DEĞİL) bir <script src> ile yüklenmeli.
(function() {
    try {
        var raw = localStorage.getItem('focusai_lastActiveTab');
        if (!raw) return;
        var target = JSON.parse(raw);
        if (!target || target === 'bugun') return;
        if (!document.getElementById(target)) return;
        document.querySelectorAll('.page-section').forEach(function(s) {
            s.classList.toggle('active', s.id === target);
        });
        document.querySelectorAll('.nav-links li[data-target]').forEach(function(nav) {
            nav.classList.toggle('active', nav.getAttribute('data-target') === target);
        });
        document.querySelectorAll('#app-dock .di[data-target]').forEach(function(d) {
            d.classList.toggle('act', d.getAttribute('data-target') === target);
        });
        document.body.setAttribute('data-active-tab', target);
    } catch (e) { /* localStorage kapalı vb. — normal akış devralır */ }
})();
