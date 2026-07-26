// ============================================================
// FOCUSAI SOCIAL-NOTIF-SOUNDS.JS
// social.js'ten çıkarılmış sesli/masaüstü bildirim sistemi:
// Web Audio API tabanlı bildirim/oda giriş-çıkış sesleri, tarayıcı
// (Notification API) masaüstü bildirimleri, sağ üst sohbet toast'ı.
// window._escapeHtml (storage-manager.js/social.js) globaline
// bağımlı — ondan SONRA yüklenmeli.
// ============================================================
(function () {
'use strict';

// Genel amaçlı kısa bildirim sesi — Web Audio API ile, dosya gerektirmez.
// 'message'  -> sohbet mesajı geldiğinde (kısa "ding")
// 'alert'    -> davet/istek/yanıt geldiğinde (biraz daha belirgin "ding-ding")
// Kullanıcı etkileşimi sonrası ses çalmaya izin ver
let _audioUnlocked = false;
document.addEventListener('click', () => { _audioUnlocked = true; }, { once: true, capture: true });
document.addEventListener('keydown', () => { _audioUnlocked = true; }, { once: true, capture: true });

function playNotificationSound(kind = 'message') {
    if (window._focusHushActive) return; // odak modunda sesler susar
    if (!_audioUnlocked) return; // Kullanıcı henüz sayfayla etkileşime geçmedi
    if (localStorage.getItem('focusai_notif_sound') === 'false') return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const freqSets = {
            message: [660, 880],
            alert:   [988, 740, 988]
        };
        const freqs = freqSets[kind] || freqSets.message;
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.12;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            osc.start(t); osc.stop(t + 0.3);
        });
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
}
window.playNotificationSound = playNotificationSound;

// Çalışma odasına girişte/ayrılışta çalınan kısa, birbirinden farklı sesler
// (Web Audio API ile sentezlenir, dosya gerektirmez).
function _playToneSequence(tones) {
    if (!_audioUnlocked) return;
    if (localStorage.getItem('focusai_notif_sound') === 'false') return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        tones.forEach(({ freq, start, dur, gain, type }) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + start;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain || 0.18, t + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.start(t); osc.stop(t + dur + 0.02);
        });
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
}

// Çalışma odasına giriş sesi — yükselen iki ton ("yukarı doğru" hissi)
function playRoomJoinSound() {
    _playToneSequence([
        { freq: 523.25, start: 0,    dur: 0.16, type: 'sine' }, // C5
        { freq: 783.99, start: 0.09, dur: 0.22, type: 'sine' }  // G5
    ]);
}
window.playRoomJoinSound = playRoomJoinSound;

// Çalışma odasından ayrılış sesi — alçalan iki ton ("aşağı doğru" hissi)
function playRoomLeaveSound() {
    _playToneSequence([
        { freq: 659.25, start: 0,    dur: 0.16, type: 'sine' }, // E5
        { freq: 392.00, start: 0.09, dur: 0.24, type: 'sine' }  // G4
    ]);
}
window.playRoomLeaveSound = playRoomLeaveSound;

// Masaüstü bildirimi izni iste (sohbet bildirimleri açıldığında çağrılır)
function requestDesktopNotificationPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}
window.requestDesktopNotificationPermission = requestDesktopNotificationPermission;

// Sekme arka plandaysa (gizliyse) tarayıcı bildirimi göster
function maybeShowDesktopNotification(title, body) {
    if (localStorage.getItem('focusai_chat_notif_sound') === 'false') return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return; // sekme açıkken zaten ekran içi toast gösteriliyor
    try {
        new Notification(title, {
            body,
            icon: 'https://ui-avatars.com/api/?name=FA&background=6c5ce7&color=fff&size=192'
        });
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
}
// social.js'in geri kalanı bu fonksiyonu çıplak (window'suz) çağırıyor —
// window'a atamak, aynı realm'de bare identifier çözümlemesiyle o
// çağrıların da doğru çalışmasını sağlıyor.
window.maybeShowDesktopNotification = maybeShowDesktopNotification;

// Aynı kişi/gruptan art arda gelen mesajlarda alt alta yığılmasın diye —
// her sohbet için (key) tek bir baloncuk tutulur, yeni mesaj geldikçe içeriği güncellenir.
const _chatToastsByKey = {};

// Sağ üstte beliren sohbet mesajı bildirimi — tıklanınca ilgili sohbeti açar
function showChatNotificationToast({ key, avatarHtml, title, body, onClick }) {
    if (window._focusHushActive) return; // odak modunda sohbet toast'ları bastırılır
    let stack = document.getElementById('social-toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'social-toast-stack';
        stack.className = 'social-toast-stack';
        document.body.appendChild(stack);
    }

    let toast = key ? _chatToastsByKey[key] : null;
    const isNew = !toast;
    if (isNew) {
        toast = document.createElement('div');
        toast.className = 'social-toast';
        toast.style.cursor = 'pointer';
    } else {
        clearTimeout(toast._removeTimer);
        toast.classList.remove('is-leaving');
        if (toast._clickHandler) toast.removeEventListener('click', toast._clickHandler);
    }

    toast.innerHTML = `
        ${avatarHtml || '<span class="st-emoji">💬</span>'}
        <div class="st-text">
            <div><b>${window._escapeHtml(title)}</b></div>
            ${body ? `<div class="st-sub">${window._escapeHtml(body)}</div>` : ''}
        </div>`;

    if (key) _chatToastsByKey[key] = toast;
    if (isNew) {
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-visible'));
    }

    const remove = () => {
        toast.classList.add('is-leaving');
        toast.classList.remove('is-visible');
        setTimeout(() => {
            toast.remove();
            if (key && _chatToastsByKey[key] === toast) delete _chatToastsByKey[key];
        }, 260);
    };
    toast._removeTimer = setTimeout(remove, 5000);

    const clickHandler = () => {
        clearTimeout(toast._removeTimer);
        remove();
        if (typeof onClick === 'function') onClick();
    };
    toast._clickHandler = clickHandler;
    toast.addEventListener('click', clickHandler);
}
// social.js'in geri kalanı bu fonksiyonu da çıplak çağırıyor (bkz. yukarıdaki not).
window.showChatNotificationToast = showChatNotificationToast;

})();

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export'lar.
export const playNotificationSound = window.playNotificationSound;
export const requestDesktopNotificationPermission = window.requestDesktopNotificationPermission;
export const maybeShowDesktopNotification = window.maybeShowDesktopNotification;
