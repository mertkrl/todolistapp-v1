// ─── DC MESAJ DÜZENLE / SİL ─────────────────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Paylaşılan DC
// sohbet state'i artık state/dc-message-render-store.js + state/dc-chat-view-store.js
// üzerinden okunuyor (gerçek getter/setter).
import { getActiveChatTarget } from '../state/active-chat-target-store.js';
import { getDcCurrentGroupId, getDcCurrentMsgPath } from '../state/dc-chat-view-store.js';
import { getDcCurrentConversation, getDcMsgRegistry, getDcSelectedKeys } from '../state/dc-message-render-store.js';
import { _escapeHtml, getDB } from './social-misc-pure-utils.js';
import { dcShowUndoToast, dcShowDeleteChoice, DC_DELETE_FOR_EVERYONE_LIMIT_MS } from './social-dc-confirm-toasts.js';
import { dcAddDeletedForMe } from './social-chat-local-delete.js';

// ─── MESAJ DÜZENLE ───────────────────────────────────
window.startDcMsgEdit = startDcMsgEdit;
export function startDcMsgEdit(msgKey, rowEl, textEl, m) {
    // Supabase-öncelikli: database null olsa bile Supabase yolu çalışır
    if (!getDcCurrentGroupId() && !getDcCurrentConversation()) return;
    if (rowEl.querySelector('.dc-msg-edit-box')) return; // zaten düzenleniyor
    const database = getDB(); // Firebase kaldırıldı — null; Supabase dalı zaten yukarıda öncelikli

    textEl.style.display = 'none';

    const editBox = document.createElement('div');
    editBox.className = 'dc-msg-edit-box';
    editBox.innerHTML = `
        <textarea class="dc-msg-edit-input">${_escapeHtml(m.text)}</textarea>
        <div class="dc-msg-edit-actions">
            <button class="dc-confirm-btn dc-confirm-cancel" data-action="cancel-edit">Vazgeç</button>
            <button class="dc-confirm-btn dc-confirm-ok" data-action="save-edit">Kaydet</button>
        </div>
    `;
    textEl.insertAdjacentElement('afterend', editBox);

    const textarea = editBox.querySelector('.dc-msg-edit-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });

    const finish = () => {
        editBox.remove();
        textEl.style.display = '';
    };

    editBox.querySelector('[data-action="cancel-edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        finish();
    });
    editBox.querySelector('[data-action="save-edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        const newText = textarea.value.trim();
        if (!newText) return;
        if (newText !== m.text) {
            if ((getDcCurrentConversation() || getDcCurrentGroupId()) && window.FocusSupabase) {
                const targetUsername = getActiveChatTarget()?.username;
                const applyUpdate = (fields) => {
                    window.FocusSupabase.from('messages').update(Object.assign({ edited: true }, fields)).eq('id', msgKey)
                        .then(({ error }) => { if (error) console.error('[DM] mesaj düzenleme hatası', error); });
                };
                applyUpdate({ text: newText, enc: null });
            } else {
                database.ref(`${getDcCurrentMsgPath()}/${msgKey}`).update({ text: newText, edited: true });
            }
        }
        finish();
    });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            editBox.querySelector('[data-action="save-edit"]').click();
        } else if (e.key === 'Escape') {
            finish();
        }
    });
    textarea.addEventListener('click', e => e.stopPropagation());
}

// ─── MESAJ SİL ───────────────────────────────────────
window.deleteDcMsg = deleteDcMsg;
export function deleteDcMsg(msgKey, rowEl, opts) {
    // Supabase-öncelikli: database null olsa bile Supabase yolu çalışır
    if (!getDcCurrentGroupId() && !getDcCurrentConversation() && !getDcCurrentMsgPath()) return;
    const database = getDB(); // Firebase fallback (null olabilir — Supabase path aşağıda kontrol edilir)
    const path = getDcCurrentMsgPath();

    const m = getDcMsgRegistry()[msgKey];
    const forceAllowEveryone = opts && opts.forceAllowEveryone;
    const allowEveryone = forceAllowEveryone || !m || !m.timestamp || (Date.now() - m.timestamp) < DC_DELETE_FOR_EVERYONE_LIMIT_MS;

    dcShowDeleteChoice({
        title: 'Mesajı Sil',
        allowEveryone,
        onDeleteForMe: () => {
            getDcSelectedKeys().delete(msgKey);
            if (rowEl) rowEl.style.display = 'none';
            dcShowUndoToast('Mesaj silindi.', {
                onUndo: () => {
                    if (rowEl) rowEl.style.display = '';
                },
                onCommit: () => {
                    dcAddDeletedForMe(path, [msgKey]);
                    delete getDcMsgRegistry()[msgKey];
                    if (rowEl) rowEl.remove();
                }
            });
        },
        onDeleteForEveryone: () => {
            getDcSelectedKeys().delete(msgKey);
            if (rowEl) rowEl.style.display = 'none';
            dcShowUndoToast('Mesaj herkesten silindi.', {
                onUndo: () => {
                    if (rowEl) rowEl.style.display = '';
                },
                onCommit: () => {
                    if (window.FocusSupabase && (getDcCurrentConversation() || getDcCurrentGroupId())) {
                        window.FocusSupabase.from('messages').delete().eq('id', msgKey)
                            .then(({ error }) => { if (error) console.error('[Sil] mesaj silme hatası', error); });
                    } else if (database && path) {
                        database.ref(`${path}/${msgKey}`).remove();
                    }
                    delete getDcMsgRegistry()[msgKey];
                }
            });
        }
    });
}
