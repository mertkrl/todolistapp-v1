// social-focus-hush.js — Odak modunda sohbet susturma (hush) (2026-07-18)
// social.js'ten izole edildi.
import { getHushedNotifQueue, setHushedNotifQueue, ensureHushedNotifQueue } from '../state/hushed-notif-queue-store.js';

// ─── ODAK MODUNDA SOHBET SUSTURMA (hush) ────────────────────
// Odak fazında sohbet soluklaşır, ses/toast bildirimleri bastırılır.
// Mola gelince otomatik açılır — "buraya sohbete değil çalışmaya gelinir".
// Odak kalkanı iki kaynaktan tetiklenir ve OR'lanır: grup seansı fazları
// (gfShowPhaseTransition) ve kişisel zamanlayıcı (setFocusState). Böylece
// biri kapanınca diğerinin koruması bozulmaz.
let _hushPersonal = false;
let _hushGroup = false;

export function dcSetHushMode(on, source) {
    if (source === 'personal') _hushPersonal = !!on; else _hushGroup = !!on;
    const eff = _hushPersonal || _hushGroup;
    const wasActive = !!window._focusHushActive;
    window._focusHushActive = eff;
    // Süzülen sohbet butonu odak sırasında kaybolur (CSS: body.dc-focus-shield)
    document.body.classList.toggle('dc-focus-shield', eff);
    const area = document.getElementById('dc-chat-area');
    if (area) area.classList.toggle('dc-hush', eff);
    let banner = document.getElementById('dc-hush-banner');
    if (eff) {
        if (!banner && area) {
            banner = document.createElement('div');
            banner.id = 'dc-hush-banner';
            banner.innerHTML = '<i class="fa-solid fa-brain"></i> Odak modundasın — sohbet molada açılır';
            const header = document.getElementById('dc-chat-header');
            if (header && header.parentNode === area) header.insertAdjacentElement('afterend', banner);
            else area.prepend(banner);
        }
    } else if (banner) {
        banner.remove();
    }
    // Odak bitti: bastırılan bildirimleri tek bir özet toast'a indir
    if (wasActive && !eff) _flushHushedNotifs();
}
window.dcSetHushMode = dcSetHushMode;

// Odak sırasında bastırılan sosyal bildirimlerin kuyruğu (başlıklar).
// showGenericNotifToast odak kalkanı açıkken buraya yazar (bkz. social.js,
// getHushedNotifQueue()); kalkan inince hepsi tek bir özetle gösterilir —
// 25 dakikada 5 toast yerine seans sonunda 1.
ensureHushedNotifQueue();

function _flushHushedNotifs() {
    if (!getHushedNotifQueue().length) return;
    const n = getHushedNotifQueue().length;
    const titles = [];
    getHushedNotifQueue().forEach(t => { if (t && !titles.includes(t) && titles.length < 3) titles.push(t); });
    const rest = n - titles.length;
    setHushedNotifQueue([]);
    window.showGenericNotifToast({
        icon: 'fa-bell',
        accent: '#D4900E',
        title: n === 1 ? 'Odaktayken 1 bildirim sessize alındı' : `Odaktayken ${n} bildirim sessize alındı`,
        body: titles.join(' · ') + (rest > 0 ? ` · +${rest} daha` : '')
    });
}
