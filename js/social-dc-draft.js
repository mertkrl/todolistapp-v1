// social-dc-draft.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): taslak (draft) kaydı/geri
// yükleme (getDcDraftKey/saveDcDraft/restoreDcDraft/clearDcDraft) ve
// spam/rate-limit koruması (canSendDcMessage/showDcRateLimitWarning).
// Kendi state'i (_dcSendTimestamps/_dcRateLimitWarningShown) tamamen izole.
//
// Dış bağımlılık: sadece getActiveChatTarget().
// ─── TASLAK (DRAFT) KAYDI ───────────────────────────────
import { getActiveChatTarget } from '../state/active-chat-target-store.js';
function getDcDraftKey() {
        const target = getActiveChatTarget();
        if (!target) return null;
        if (target.type === 'dm') return `focusai_chat_draft_dm_${target.username}`;
        return `focusai_chat_draft_group_${target.code}_${target.roomId}_${target.channelId || ''}`;
    }

export function saveDcDraft(inputEl) {
        const key = getDcDraftKey();
        if (!key) return;
        const text = inputEl.value;
        if (text) localStorage.setItem(key, text);
        else localStorage.removeItem(key);
    }

    window.saveDcDraft = saveDcDraft;

export function restoreDcDraft(inputEl) {
        const key = getDcDraftKey();
        if (!key) return;
        const draft = localStorage.getItem(key);
        if (draft) {
            inputEl.value = draft;
            inputEl.focus();
            inputEl.setSelectionRange(draft.length, draft.length);
        }
    }

    window.restoreDcDraft = restoreDcDraft;

export function clearDcDraft() {
        const key = getDcDraftKey();
        if (key) localStorage.removeItem(key);
    }

    window.clearDcDraft = clearDcDraft;

    // ─── SPAM / RATE-LIMIT KORUMASI ─────────────────────────
    const DC_RATE_LIMIT_COUNT  = 5;     // Pencere içinde izin verilen mesaj sayısı
    const DC_RATE_LIMIT_WINDOW = 10000; // Pencere süresi (ms)
    let _dcSendTimestamps = [];

export function canSendDcMessage() {
        const now = Date.now();
        _dcSendTimestamps = _dcSendTimestamps.filter(t => now - t < DC_RATE_LIMIT_WINDOW);
        if (_dcSendTimestamps.length >= DC_RATE_LIMIT_COUNT) {
            showDcRateLimitWarning();
            return false;
        }
        _dcSendTimestamps.push(now);
        return true;
    }

    window.canSendDcMessage = canSendDcMessage;

    let _dcRateLimitWarningShown = false;
    function showDcRateLimitWarning() {
        if (_dcRateLimitWarningShown) return;
        _dcRateLimitWarningShown = true;
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (streamEl) {
            const warn = document.createElement('div');
            warn.className = 'dc-rate-limit-warning';
            warn.style.textAlign = 'center';
            warn.style.color = '#ff7675';
            warn.style.fontSize = '12px';
            warn.style.padding = '6px';
            warn.style.opacity = '0.9';
            warn.textContent = 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla 🙂';
            streamEl.appendChild(warn);
            streamEl.scrollTop = streamEl.scrollHeight;
            setTimeout(() => warn.remove(), 3000);
        }
        setTimeout(() => { _dcRateLimitWarningShown = false; }, 3000);
    }

