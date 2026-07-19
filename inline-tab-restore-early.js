// inline-tab-restore-early.js — index.html <head>'deki 2. inline <script>'ten taşındı.
// ══ ERKEN SEKME RESTORASYONU (flash önleme, faz 1) ══
// Sayfanın geri kalanı (binlerce satır section markup'ı) parse edilmeden
// ÖNCE, henüz DOM'da hiçbir section/dock elemanı yokken CSS kuralı olarak
// enjekte edilir. Böylece tarayıcı ilk boyamayı zaten doğru sekme VE doğru
// dock/nav vurgusuyla yapar — HTML'deki statik "Bugün" varsayılanı (hem
// içerik hem sol dock ikonu) hiç görünmez. (bkz. index.html sonundaki DOM
// tabanlı ikinci aşama — o script elementler DOM'a girdikten sonra çalışır,
// tek başına geç kalıp flash'a yol açıyordu.)
// ÖNEMLİ: bu dosya index.html <head>'inde, style.css'ten hemen sonra,
// senkron (type="module" DEĞİL, defer/async DEĞİL) bir <script src> ile
// yüklenmeli — çünkü DOM henüz parse edilmeden önce çalışması gerekiyor.
(function() {
    try {
        var raw = localStorage.getItem('focusai_lastActiveTab');
        if (!raw) return;
        var target = JSON.parse(raw);
        var VALID = ['hedefler','zihin-coplugu','aliskanliklar','zamanlayici','takvim','istatistikler','gunluk','arkadaslar','planlama'];
        if (VALID.indexOf(target) === -1) return; // 'bugun'/bilinmeyen → varsayılan kalsın
        // document.write yerine: <head> parse edilirken document.head zaten
        // erişilebilir olduğu için aynı senkron etkiyi (ilk boyamadan önce
        // uygulanan stil) bir <style> elemanını doğrudan ekleyerek elde
        // ediyoruz — document.write tarayıcı tarafından eski/anti-pattern
        // olarak işaretleniyor (Lighthouse uyarısı) ve modern tarayıcılarda
        // ağdan yüklenen script'lerde tamamen engellenebiliyor.
        var style = document.createElement('style');
        style.id = 'early-tab-restore-style';
        style.textContent =
            '#bugun.page-section.active{display:none!important}' +
            '#' + target + '.page-section{display:block!important}' +
            '#app-dock .di[data-target="bugun"].act{background:none!important;color:rgba(212,144,14,0.45)!important}' +
            '#app-dock .di[data-target="' + target + '"]{background:var(--a10)!important;color:var(--a)!important}';
        document.head.appendChild(style);
    } catch (e) { /* localStorage kapalı vb. — normal akış devralır */ }
})();
