// ─── ODAK/BEKLEME DURUMUNU PRESENCE'A YAZMA + OKUMA ─────────────────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu): kişisel/grup
// zamanlayıcısının "şu an odaklanıyorum" / "bekleme odasındayım" durumunu
// presence payload'ına yazan ve polling cache'inden okuyan 4 fonksiyon.
// Hiçbiri social.js'in goals/cwXxx/sharedFocusXxx gibi paylaşılan durumuna
// dokunmuyor — sadece `window.__getPresencePayload/__setPresencePayload/
// __getPolledPresenceCache` (zaten global köprü) üzerinden çalışıyor.
//
// window.gscGetFocusingNow/window.setWaitingState/window.gscGetWaitingNow
// köprüleri KORUNDU — social-group-details.js ve script-timer.js
// (window.FocusAISocial.setFocusState üzerinden) hâlâ bunları çağırıyor.
import { dcSetHushMode } from './social-focus-hush.js';

// Odak kalkanı: kişisel zamanlayıcı odak modundayken (mola değil) sohbet
// soluklaşır/kilitlenir, toast'lar ve bildirim sesleri susar. Presence'tan
// bağımsız çalışmalı — sosyal hesaba girilmemiş olsa bile koruma aktif.
function setFocusState(isFocusing, focusMode, groupSessionId) {
    const shieldActive = !!isFocusing && document.body.classList.contains('focus-mode-active');
    dcSetHushMode(shieldActive, 'personal');
    if (!window.__getPresencePayload()) return;
    window.__setPresencePayload({
        ...window.__getPresencePayload(),
        studying: !!isFocusing,
        focusMode: isFocusing ? (focusMode || null) : null,
        gscSessionId: isFocusing ? (groupSessionId || null) : null
    });
    window._presenceHeartbeatTick(); // anlık tek yazı (O(1)) — broadcast değil
}

// Bir grup seansı için şu an kimlerin odaklandığını polling cache'inden okur.
window.gscGetFocusingNow = (sessionId) => gscGetFocusingNow(sessionId); // Faz 5: social-group-details.js için
function gscGetFocusingNow(sessionId) {
    if (!sessionId) return [];
    const result = [];
    Object.values(window.__getPolledPresenceCache()).forEach(metas => {
        (metas || []).forEach(m => { if (m.gscSessionId === sessionId) result.push(m); });
    });
    return result;
}

// Bir seansın bekleme odasına girdiğini/çıktığını presence'a yazar.
window.setWaitingState = (sessionId) => setWaitingState(sessionId); // Faz 5: social-group-details.js için
function setWaitingState(sessionId) {
    if (!window.__getPresencePayload()) return;
    window.__setPresencePayload({ ...window.__getPresencePayload(), waitingForSessionId: sessionId || null });
    window._presenceHeartbeatTick();
}

// Bir seansın bekleme odasında şu an kimlerin olduğunu polling cache'inden okur.
window.gscGetWaitingNow = (sessionId) => gscGetWaitingNow(sessionId); // Faz 5: social-group-details.js için
function gscGetWaitingNow(sessionId) {
    if (!sessionId) return [];
    const result = [];
    Object.values(window.__getPolledPresenceCache()).forEach(metas => {
        (metas || []).forEach(m => { if (m.waitingForSessionId === sessionId) result.push(m); });
    });
    return result;
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { setFocusState, gscGetFocusingNow, setWaitingState, gscGetWaitingNow };
