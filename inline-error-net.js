// inline-error-net.js — index.html'deki ilk <script> bloğundan taşındı.
// ══ GLOBAL HATA GÜVENLİK AĞI ══
// script.js/social.js/planning.js/collab.js içindeki çok sayıda await
// çağrısı try/catch olmadan bırakılmış (bkz. denetim raporu). Her birini
// tek tek sarmak yerine, hangisi patlarsa patlasın hiçbir hata artık
// tamamen sessiz kalmasın diye tüm sayfa için tek bir güvenlik ağı: en
// erken noktada kayıt edilir ki sayfa ömrü boyunca hiçbir
// unhandledrejection/error kaçmasın. Davranışı DEĞİŞTİRMEZ (hatayı
// yutmaz/engellemez), sadece konsola görünür kılar.
(function() {
    window.addEventListener('unhandledrejection', function(ev) {
        console.warn('[FocusAI] yakalanmamış promise hatası:', ev.reason);
    });
    window.addEventListener('error', function(ev) {
        console.warn('[FocusAI] yakalanmamış hata:', ev.error || ev.message);
    });
})();
