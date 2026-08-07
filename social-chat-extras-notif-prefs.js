// social-chat-extras-notif-prefs.js
// social-chat-extras.js'ten çıkarıldı: FAZ 2 bildirim tercihleri & DND.
// window.FocusChat.NotifPrefs + modal aç/kaydet + otomatik buton bağlama.
// Dış bağımlılıklar: window.FocusSupabase gerekmez (localStorage tabanlı),
// getDcCurrentGroupScope (state modülünden import).

import { getDcCurrentGroupScope } from './state/dc-current-group-scope-store.js';

window.FocusChat = window.FocusChat || {};

window.FocusChat.NotifPrefs = {
    _key: 'focusai_notif_prefs',

    load() {
        try { return JSON.parse(localStorage.getItem(this._key) || '{}', window._safeJsonReviver); }
        catch { return {}; }
    },
    save(prefs) { localStorage.setItem(this._key, JSON.stringify(prefs)); },

    isDndActive() {
        const p = this.load();
        if (!p.dndEnabled) return false;
        const now   = new Date();
        const hhmm  = now.getHours() * 60 + now.getMinutes();
        const start = this._timeToMin(p.dndStart || '22:00');
        const end   = this._timeToMin(p.dndEnd   || '08:00');
        if (start > end) return hhmm >= start || hhmm < end;
        return hhmm >= start && hhmm < end;
    },

    _timeToMin(t) {
        const [h, m] = (t || '0:0').split(':').map(Number);
        return h * 60 + (m || 0);
    },

    getChannelLevel(scopeKey) {
        const p = this.load();
        return (p.channelLevels || {})[scopeKey] || 'all';
    },

    setChannelLevel(scopeKey, level) {
        const p = this.load();
        p.channelLevels = p.channelLevels || {};
        p.channelLevels[scopeKey] = level;
        this.save(p);
    }
};

window.FocusChat.openNotifPrefsModal = function() {
    const modal = document.getElementById('notif-prefs-modal');
    if (!modal) return;
    const p = window.FocusChat.NotifPrefs.load();

    const dndToggle     = document.getElementById('dnd-enabled-toggle');
    const dndRange      = document.getElementById('dnd-time-range');
    const dndStart      = document.getElementById('dnd-start-time');
    const dndEnd        = document.getElementById('dnd-end-time');
    const soundToggle   = document.getElementById('notif-sound-toggle');
    const desktopToggle = document.getElementById('notif-desktop-toggle');
    const channelLevel  = document.getElementById('channel-notif-level');

    if (dndToggle)     dndToggle.checked     = !!p.dndEnabled;
    if (dndStart)      dndStart.value         = p.dndStart || '22:00';
    if (dndEnd)        dndEnd.value           = p.dndEnd   || '08:00';
    if (dndRange)      dndRange.style.display = p.dndEnabled ? 'flex' : 'none';
    if (soundToggle)   soundToggle.checked    = localStorage.getItem('focusai_notif_sound') !== 'false';
    if (desktopToggle) desktopToggle.checked  = Notification.permission === 'granted';

    const scope = getDcCurrentGroupScope();
    const scopeKey = scope ? `${scope.type}:${scope.id}` : null;
    if (channelLevel && scopeKey) {
        channelLevel.value = window.FocusChat.NotifPrefs.getChannelLevel(scopeKey);
    }

    dndToggle?.addEventListener('change', () => {
        if (dndRange) dndRange.style.display = dndToggle.checked ? 'flex' : 'none';
    });

    modal.classList.remove('hidden');
};

window.FocusChat.saveNotifPrefs = function() {
    const dndEnabled = document.getElementById('dnd-enabled-toggle')?.checked || false;
    const dndStart   = document.getElementById('dnd-start-time')?.value || '22:00';
    const dndEnd     = document.getElementById('dnd-end-time')?.value   || '08:00';
    const sound      = document.getElementById('notif-sound-toggle')?.checked !== false;
    const desktop    = document.getElementById('notif-desktop-toggle')?.checked || false;
    const chanLevel  = document.getElementById('channel-notif-level')?.value || 'all';

    const np = window.FocusChat.NotifPrefs;
    const existing = np.load();
    np.save({ ...existing, dndEnabled, dndStart, dndEnd });

    localStorage.setItem('focusai_notif_sound', sound ? 'true' : 'false');

    const scope = getDcCurrentGroupScope();
    if (scope) np.setChannelLevel(`${scope.type}:${scope.id}`, chanLevel);

    if (desktop && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    document.getElementById('notif-prefs-modal')?.classList.add('hidden');
    dcShowToast('✅ Bildirim ayarları kaydedildi');
};

(function initNotifPrefsModal() {
    const tryBind = () => {
        const saveBtn  = document.getElementById('notif-prefs-save');
        const closeBtn = document.getElementById('notif-prefs-close');
        if (!saveBtn) { setTimeout(tryBind, 800); return; }
        saveBtn.addEventListener('click', window.FocusChat.saveNotifPrefs);
        closeBtn?.addEventListener('click', () => document.getElementById('notif-prefs-modal')?.classList.add('hidden'));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryBind);
    else tryBind();
})();

(function bindFaz2ChatButtons() {
    const tryBind = () => {
        const notifBtn = document.getElementById('dc-notif-btn');
        if (!notifBtn) { setTimeout(tryBind, 800); return; }

        notifBtn.addEventListener('click', () => {
            window.FocusChat.openNotifPrefsModal();
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryBind);
    else tryBind();
})();
