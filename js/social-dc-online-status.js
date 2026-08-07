import { getDB } from './social-misc-pure-utils.js';
// social-dc-online-status.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): sohbetteki çevrimiçi durum
// noktası takibi (subscribeDcOnlineStatus/updateDcStatusDots) + mesaj
// listesinde tarih ayırıcılar (dcFormatDateSeparator/dcRebuildDateSeparators).
// Kendi state'i (_dcOnlineStatusCache/_dcOnlineSubs) tamamen izole.
//
// Dış bağımlılık: sadece getDB.

// ─── ÇEVRİMİÇİ DURUM NOKTASI ──────────────────────────
let _dcOnlineStatusCache = {};
let _dcOnlineSubs = new Set();

export function subscribeDcOnlineStatus(username) {
    if (!username) return;
    if (_dcOnlineStatusCache[username] !== undefined) {
        updateDcStatusDots(username, _dcOnlineStatusCache[username]);
    }
    if (_dcOnlineSubs.has(username)) return;
    const database = getDB();
    if (!database) return;
    _dcOnlineSubs.add(username);
    database.ref(`focusai_community/users/${username}/online`).on('value', snap => {
        const isOnline = !!snap.val();
        _dcOnlineStatusCache[username] = isOnline;
        updateDcStatusDots(username, isOnline);
    });
}

function updateDcStatusDots(username, isOnline) {
    document.querySelectorAll(`.dc-msg-status-dot[data-online-user="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`).forEach(dot => {
        dot.classList.toggle('online', isOnline);
        dot.classList.toggle('offline', !isOnline);
    });
    const headerDot = document.getElementById('dc-header-status-dot');
    if (headerDot && headerDot.dataset.onlineUser === username) {
        headerDot.classList.toggle('online', isOnline);
        headerDot.classList.toggle('offline', !isOnline);
    }
}

// ─── TARİH AYIRICILAR ─────────────────────────────────
function dcFormatDateSeparator(ts) {
    const d = new Date(ts);
    const now = new Date();
    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return `${d.getDate()} ${months[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

export function dcRebuildDateSeparators(container) {
    container.querySelectorAll('.dc-date-separator').forEach(el => el.remove());
    let lastLabel = null;
    container.querySelectorAll('.dc-dm-msg-row[data-timestamp]').forEach(row => {
        const ts = parseInt(row.dataset.timestamp || '0', 10);
        if (!ts) return;
        const label = dcFormatDateSeparator(ts);
        if (label !== lastLabel) {
            const sep = document.createElement('div');
            sep.className = 'dc-date-separator';
            sep.innerHTML = `<span class="dc-date-separator-line"></span><span class="dc-date-separator-label">${label}</span><span class="dc-date-separator-line"></span>`;
            row.parentNode.insertBefore(sep, row);
            lastLabel = label;
        }
    });
}
