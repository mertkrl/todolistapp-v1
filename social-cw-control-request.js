// ─── COWORKING ODASI: KATILIMCI→SAHİP KONTROL İSTEĞİ AKIŞI ────────────────
// social.js dosyasından çıkarıldı (2026-07-30, currentRoomId state-store
// refactoru sonrası). Sahip olmayan bir katılımcı pause/start/skip'e
// bastığında doğrudan uygulamak yerine sahibe broadcast ile istek gönderir;
// sahip onaylarsa kendi client'ında gerçek aksiyonu tetikler ve sonucu
// `request_result` ile isteği gönderene bildirir.
//
// Bu küme daha önce currentRoomId/_cwRoomSupaChannel/_cwRoomAllowRequests
// gibi social.js'in bare closure değişkenlerine bağımlı olduğu için
// çıkarılamıyordu — hepsi artık state/cw-current-room-store.js +
// state/cw-control-request-store.js'te gerçek store, bu yüzden köprüsüz
// taşınabildi.
//
// social.js'te KALAN (taşınmayan) fonksiyonlara window köprüsüyle erişiliyor:
// requestSharedFocusStart/requestSharedFocusPauseToggle/applySharedFocusSkip
// (odaklanma zamanlayıcı motorunun bir parçası, sharedFocusSession gibi
// başka paylaşımlı state'e bağımlı — bu görevin kapsamı dışında).
// Dışarıdan (gfEnsureRoomControlBindings / _cwSetupSupaRoomUI, ikisi de
// social.js'te kalıyor) çağrılabilmesi için window._cwSendControlRequest
// ve window._cwShowIncomingControlRequest köprüleri de eklendi.
import { getCurrentUser } from './state/current-user-store.js';
import {
    getCurrentRoomId, getCwRoomSupaChannel, getCwRoomAllowRequests
} from './state/cw-current-room-store.js';
import {
    setCwPendingControlRequest,
    getCwMyRequestInFlight, setCwMyRequestInFlight,
    getCwRequestSpamAttempts, setCwRequestSpamAttempts,
    getCwRequestLockoutUntil, setCwRequestLockoutUntil
} from './state/cw-control-request-store.js';
import { _cwNormalizeSupaRoom } from './social-misc-isolated-utils.js';
import { _escapeHtml } from './social-misc-pure-utils.js';

const CW_REQUEST_COOLDOWN_MS = 10000;
const CW_REQUEST_SPAM_THRESHOLD = 3;
const CW_REQUEST_LOCKOUT_MS = 60000;

export function _cwSetControlBtnsDisabled(disabled) {
    ['gf-start-btn', 'gf-pause-btn', 'gf-skip-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = disabled;
    });
}

window._cwSendControlRequest = _cwSendControlRequest; // gfEnsureRoomControlBindings (social.js) için
export function _cwSendControlRequest(reqType) {
    if (!getCwRoomSupaChannel() || !getCurrentUser()) return;
    if (!getCwRoomAllowRequests()) return; // owner istek göndermeyi tamamen kapatmış

    const now = Date.now();
    if (now < getCwRequestLockoutUntil()) {
        const secsLeft = Math.ceil((getCwRequestLockoutUntil() - now) / 1000);
        window.dcShowToast?.(`Çok fazla istek gönderdin — ${secsLeft} sn sonra tekrar dene.`);
        return;
    }

    if (getCwMyRequestInFlight()) {
        setCwRequestSpamAttempts(getCwRequestSpamAttempts() + 1);
        if (getCwRequestSpamAttempts() >= CW_REQUEST_SPAM_THRESHOLD) {
            setCwRequestLockoutUntil(now + CW_REQUEST_LOCKOUT_MS);
            setCwRequestSpamAttempts(0);
            _cwSetControlBtnsDisabled(true);
            setTimeout(() => { _cwSetControlBtnsDisabled(false); }, CW_REQUEST_LOCKOUT_MS);
            window.dcShowToast?.('Çok fazla istek gönderdin — 1 dakika boyunca butonlar devre dışı.');
        } else {
            window.dcShowToast?.('Zaten bekleyen bir isteğin var — yanıt bekle.');
        }
        return;
    }

    setCwRequestSpamAttempts(0);
    setCwMyRequestInFlight(true);
    setTimeout(() => { setCwMyRequestInFlight(false); }, CW_REQUEST_COOLDOWN_MS);
    getCwRoomSupaChannel().send({
        type: 'broadcast', event: 'participant_request',
        payload: { reqType, displayName: getCurrentUser().displayName || getCurrentUser().username || 'Kullanıcı' }
    });
    const labels = { start: 'Başlatma', pause: 'Duraklatma', resume: 'Başlatma', skip: 'Sonraki aşama' };
    window.dcShowToast?.(`${labels[reqType] || 'İstek'} isteği gönderildi ✋`);
}

window._cwShowIncomingControlRequest = _cwShowIncomingControlRequest; // _cwSetupSupaRoomUI (social.js) için
export function _cwShowIncomingControlRequest(reqType, displayName) {
    setCwPendingControlRequest({ reqType, displayName });
    document.getElementById('cw-control-request-toast')?.remove();
    const labels = { start: 'başlatmak', pause: 'duraklatmak', resume: 'başlatmak', skip: 'sonraki aşamaya geçmek' };
    const box = document.createElement('div');
    box.id = 'cw-control-request-toast';
    box.style.position = 'fixed';
    box.style.top = '20px';
    box.style.left = '50%';
    box.style.transform = 'translateX(-50%)';
    box.style.zIndex = '10400';
    box.style.background = 'rgba(18,16,40,0.97)';
    box.style.border = '1px solid rgba(212,144,14,0.4)';
    box.style.borderRadius = '14px';
    box.style.padding = '14px 18px';
    box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.55)';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.gap = '12px';
    box.style.maxWidth = '90vw';
    box.innerHTML = `
        <span class="u-color-hfff_font-size-13px"><b>${_escapeHtml(displayName)}</b> odayı ${labels[reqType] || 'yönetmek'} istiyor ✋</span>
        <button id="cw-control-req-approve" class="u-background-h2ed573_border-none_color-h000_font-weight-700_">Onayla</button>
        <button id="cw-control-req-deny" class="u-background-rgba2552552550p1_border-none_color-hfff_padding">Reddet</button>
    `;
    document.body.appendChild(box);
    const cleanup = () => { box.remove(); setCwPendingControlRequest(null); };
    document.getElementById('cw-control-req-approve').addEventListener('click', () => {
        cleanup();
        if (reqType === 'start') window.requestSharedFocusStart();
        if (reqType === 'pause' || reqType === 'resume') window.requestSharedFocusPauseToggle();
        if (reqType === 'skip' && getCurrentRoomId() && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').select('*').eq('id', getCurrentRoomId()).single()
                .then(({ data: row }) => { if (row) window.applySharedFocusSkip(_cwNormalizeSupaRoom(row)); });
        }
        getCwRoomSupaChannel()?.send({ type: 'broadcast', event: 'request_result', payload: { reqType, approved: true } });
    });
    document.getElementById('cw-control-req-deny').addEventListener('click', () => {
        cleanup();
        getCwRoomSupaChannel()?.send({ type: 'broadcast', event: 'request_result', payload: { reqType, approved: false } });
    });
    setTimeout(() => { if (document.getElementById('cw-control-request-toast')) cleanup(); }, 15000);
}
