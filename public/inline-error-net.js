// inline-error-net.js — index.html'deki ilk <script> bloğundan taşındı.
// ══ GLOBAL HATA GÜVENLİK AĞI + UZAKTAN HATA RAPORLAMA (Faz L) ══
// script.js/social.js/planning.js/collab.js içindeki çok sayıda await
// çağrısı try/catch olmadan bırakılmış (bkz. denetim raporu). Her birini
// tek tek sarmak yerine, hangisi patlarsa patlasın hiçbir hata artık
// tamamen sessiz kalmasın diye tüm sayfa için tek bir güvenlik ağı: en
// erken noktada kayıt edilir ki sayfa ömrü boyunca hiçbir
// unhandledrejection/error kaçmasın. Konsol logunu KORUR (davranışı
// değiştirmez), ayrıca artık `client_error_logs` tablosuna (bkz.
// supabase/migrations/133_client_error_logs.sql) da gönderir ki üretimde
// kimse konsolu izlemeden de hatalar görülebilsin.
//
// Bu dosya index.html'de supabase-client.js'ten (ve supabase-js
// kütüphanesinden) ÇOK ÖNCE yükleniyor (en erken hatayı kaçırmamak için),
// bu yüzden window.FocusSupabase henüz mevcut değil — REST endpoint'ine
// düz fetch ile yazıyoruz. URL/anon-key sabitleri supabase-client.js'teki
// ile aynı (ikisi de zaten istemci tarafında herkese açık bilgi).
(function () {
    var SUPABASE_URL = 'https://qyzfkiideqovqiarabds.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_M4Sed5jniCGdzX6GgHvzxw_ZzlcwEpj';
    var MAX_REPORTS_PER_SESSION = 20;
    var MAX_REPEATS_PER_MESSAGE = 3;

    var sessionId = null;
    try {
        sessionId = sessionStorage.getItem('focusai_error_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
            sessionStorage.setItem('focusai_error_session_id', sessionId);
        }
    } catch (e) { /* sessionStorage kapalıysa (gizli sekme vb.) session_id'siz devam */ }

    var sentCount = 0;
    var seenMessages = Object.create(null);

    function report(kind, message, stack) {
        try {
            if (sentCount >= MAX_REPORTS_PER_SESSION) return;
            var key = kind + '|' + String(message).slice(0, 200);
            var seenBefore = seenMessages[key] || 0;
            if (seenBefore >= MAX_REPEATS_PER_MESSAGE) return;
            seenMessages[key] = seenBefore + 1;
            sentCount++;

            fetch(SUPABASE_URL + '/rest/v1/client_error_logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    kind: kind,
                    message: String(message == null ? 'boş hata' : message).slice(0, 2000),
                    stack: stack ? String(stack).slice(0, 8000) : null,
                    page_path: location.pathname.slice(0, 300),
                    user_agent: navigator.userAgent.slice(0, 300),
                    session_id: sessionId
                }),
                keepalive: true
            }).catch(function () { /* raporlama başarısız olursa sessizce yut — asıl hatayı boğmasın */ });
        } catch (e) { /* raporlama katmanının kendisi asla ana akışı bozmasın */ }
    }

    window.addEventListener('unhandledrejection', function (ev) {
        console.warn('[FocusAI] yakalanmamış promise hatası:', ev.reason);
        var reason = ev.reason;
        report('unhandledrejection', reason && reason.message ? reason.message : reason, reason && reason.stack);
    });
    window.addEventListener('error', function (ev) {
        console.warn('[FocusAI] yakalanmamış hata:', ev.error || ev.message);
        var err = ev.error;
        report('error', err && err.message ? err.message : ev.message, err && err.stack);
    });
})();
