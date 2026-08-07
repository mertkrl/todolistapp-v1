// inline-gate-prehide.js — index.html'deki #app-login-gate'ten hemen sonraki
// inline <script>'ten taşındı (2026-08-06).
//
// GERÇEK BUG: Bu mantık önce doğrudan bir inline <script> bloğu olarak
// eklenmişti, ama sayfanın CSP'si (script-src 'self' — 'unsafe-inline' YOK)
// TÜM inline <script> içeriğini sessizce engelliyor. O yüzden bu ön-gizleme
// kodu hiç çalışmıyordu ve kullanıcı her hard refresh'te giriş kapısının bir
// an görünüp kaybolduğunu (FOUC) bildirmeye devam etti — kapı sadece
// app-login-gate.js'in ASENKRON oturum kontrolü tamamlanınca (modül indirilip
// çalıştıktan, session sorgusu dönene kadar) gizleniyordu. Bu dosya, projedeki
// diğer "inline-*.js" dosyalarıyla (inline-sw-register.js, inline-error-net.js
// vb.) aynı desende, klasik (type=module DEĞİL, defer/async YOK) bir
// <script src="..."> olarak index.html'de #app-login-gate'ten hemen sonra
// yükleniyor — bu da HTML parse'ını bloklayıp SENKRON çalışmasını, yani ilk
// paint'ten önce kapıyı gizleyebilmesini sağlıyor. Gerçek oturum doğrulaması
// yine app-login-gate.js'te yapılır; bu sadece görsel titremeyi önler.
(function () {
    try {
        var hasSession = !!localStorage.getItem('focusai_dev_test_email');
        if (!hasSession) {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > -1) { hasSession = true; break; }
            }
        }
        if (hasSession) document.getElementById('app-login-gate').classList.add('hidden');
    } catch (e) {}
})();
