// social-dc-msg-selection.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, 2026-07-23):
// mesaj çoklu-seçim araç çubuğu (seç/kopyala/toplu sil). Paylaşılan state
// (_dcSelectedKeys, _dcMsgRegistry, _dcCurrentMsgPath) social.js'te kalıyor
// — hepsi getter ile (Set/obje referansı üzerinden mutasyon çalışıyor,
// reassign yok) köprülendi.
//
// Dış bağımlılıklar (window.* üzerinden): window.__getDcSelectedKeys (YENİ),
// window.__getDcCurrentMsgPath (YENİ), window.__getDcMsgRegistry,
// getDB, getUser, window.dcShowDeleteChoice,
// window.dcShowUndoToast, window.dcShowToast, window.dcAddDeletedForMe,
// DC_DELETE_FOR_EVERYONE_LIMIT_MS, window.FocusSupabase.
import { dcAddDeletedForMe } from './social-chat-local-delete.js';
import { dcShowUndoToast, dcShowDeleteChoice, DC_DELETE_FOR_EVERYONE_LIMIT_MS } from './social-dc-confirm-toasts.js';
import { getDcCurrentMsgPath } from '../state/dc-chat-view-store.js';
import { getDB, getUser } from './social-misc-pure-utils.js';
(function () {
'use strict';

    // ─── MESAJ SEÇİMİ: kopyala / ilet ────────────────────────
    function toggleDcMsgSelection(key, rowEl) {
        const nowSelected = !window.__getDcSelectedKeys().has(key);
        if (nowSelected) {
            window.__getDcSelectedKeys().add(key);
        } else {
            window.__getDcSelectedKeys().delete(key);
        }
        if (rowEl) {
            rowEl.classList.toggle('dc-msg-selected', nowSelected);
            const btn = rowEl.querySelector('[data-action="select"]');
            if (btn) {
                btn.classList.toggle('is-selected', nowSelected);
                const icon = btn.querySelector('i');
                if (icon) icon.className = nowSelected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
            }
        }
        updateDcSelectionToolbar();
    }

    window.toggleDcMsgSelection = toggleDcMsgSelection;

    function clearDcSelection() {
        window.__getDcSelectedKeys().forEach(key => {
            const row = document.querySelector(`.dc-dm-msg-row[data-msg-key="${key}"]`);
            if (!row) return;
            row.classList.remove('dc-msg-selected');
            const btn = row.querySelector('[data-action="select"]');
            if (btn) {
                btn.classList.remove('is-selected');
                const icon = btn.querySelector('i');
                if (icon) icon.className = 'fa-regular fa-circle';
            }
        });
        window.__getDcSelectedKeys().clear();
        updateDcSelectionToolbar();
    }

    window.clearDcSelection = clearDcSelection;

    function updateDcSelectionToolbar() {
        const inputEl = document.getElementById('sidebar-chat-message-input');
        const inputWrap = inputEl ? inputEl.closest('.dc-chat-input-bar') : null;
        let bar = document.getElementById('dc-selection-toolbar');
        const count = window.__getDcSelectedKeys().size;

        if (count === 0) {
            if (bar) bar.remove();
            return;
        }
        if (!bar) {
            if (!inputWrap) return;
            bar = document.createElement('div');
            bar.id = 'dc-selection-toolbar';
            bar.className = 'dc-selection-toolbar';
            inputWrap.insertBefore(bar, inputWrap.firstChild);
        }
        bar.innerHTML = `
            <span class="dc-selection-count">${count} mesaj seçildi</span>
            <div class="dc-selection-actions">
                <button class="dc-selection-btn" data-action="copy" title="Kopyala"><i class="fa-regular fa-copy"></i> Kopyala</button>
                <button class="dc-selection-btn dc-selection-danger" data-action="delete" title="Sil"><i class="fa-solid fa-trash-can"></i> Sil</button>
                <button class="dc-selection-btn dc-selection-cancel" data-action="cancel" title="İptal" aria-label="İptal"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        bar.querySelector('[data-action="copy"]').addEventListener('click', copySelectedDcMessages);
        bar.querySelector('[data-action="delete"]').addEventListener('click', deleteSelectedDcMessages);
        bar.querySelector('[data-action="cancel"]').addEventListener('click', clearDcSelection);
    }

    function deleteSelectedDcMessages() {
        const database = getDB();
        if (!database || !getDcCurrentMsgPath()) return;
        const keys = Array.from(window.__getDcSelectedKeys());
        if (!keys.length) return;

        const myUsername = (getUser() || {}).username;
        const now = Date.now();
        // Sadece kendi mesajların ve hepsi 1 saatten yeniyse "Herkesten Sil" sunulabilir
        const allowEveryone = keys.every(key => {
            const m = window.__getDcMsgRegistry()[key];
            return m && m.username === myUsername && m.timestamp && (now - m.timestamp) < DC_DELETE_FOR_EVERYONE_LIMIT_MS;
        });

        const path = getDcCurrentMsgPath();
        const rows = keys.map(key => document.querySelector(`.dc-dm-msg-row[data-msg-key="${key}"]`));

        dcShowDeleteChoice({
            title: `${keys.length} Mesajı Sil`,
            allowEveryone,
            onDeleteForMe: () => {
                rows.forEach(row => { if (row) row.style.display = 'none'; });
                clearDcSelection();
                dcShowUndoToast(`${keys.length} mesaj silindi.`, {
                    onUndo: () => {
                        rows.forEach(row => { if (row) row.style.display = ''; });
                    },
                    onCommit: () => {
                        dcAddDeletedForMe(path, keys);
                        keys.forEach((key, i) => {
                            delete window.__getDcMsgRegistry()[key];
                            if (rows[i]) rows[i].remove();
                        });
                    }
                });
            },
            onDeleteForEveryone: () => {
                rows.forEach(row => { if (row) row.style.display = 'none'; });
                clearDcSelection();
                dcShowUndoToast(`${keys.length} mesaj herkesten silindi.`, {
                    onUndo: () => {
                        rows.forEach(row => { if (row) row.style.display = ''; });
                    },
                    onCommit: () => {
                        keys.forEach(key => {
                            database.ref(`${path}/${key}`).remove();
                            delete window.__getDcMsgRegistry()[key];
                        });
                    }
                });
            }
        });
    }

    function copySelectedDcMessages() {
        const ordered = Array.from(window.__getDcSelectedKeys())
            .map(key => window.__getDcMsgRegistry()[key])
            .filter(Boolean)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const text = ordered.map(m => `${m.displayName || m.username}: ${m.text}`).join('\n');
        const done = () => { window.dcShowToast(`${ordered.length} mesaj kopyalandı.`); clearDcSelection(); };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(done);
        } else {
            done();
        }
    }

})();
