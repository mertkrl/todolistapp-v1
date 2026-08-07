// social-dc-confirm-toasts.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, 2026-07-23):
// geri alınabilir işlem toast'ı (dcShowUndoToast), özel onay penceresi
// (dcShowConfirm), mesaj silme seçeneği modalı (dcShowDeleteChoice) +
// DC_DELETE_FOR_EVERYONE_LIMIT_MS sabiti. Tamamen izole, paylaşılan mesaj/
// oda state'ine dokunmuyor — sadece kendi DOM'u ve callback'ler üzerinden
// çalışıyor. (dcShowToast'ın kendisi, 31 dış bare çağrısı olduğu için
// BİLİNÇLİ OLARAK social.js'te bırakıldı.)
//
// Dış bağımlılık: sadece window._escapeHtml.

    // ─── GERİ ALINABİLİR İŞLEM TOAST'I (ör. mesaj silme) ────────
    // `onCommit` belirtilen süre dolunca çalışır, `onUndo` ise kullanıcı
    // "Geri Al" butonuna basarsa. Aynı anda tek bir undo toast gösterilir —
    // önceki toast'ın commit'i hemen tetiklenir.
export function dcShowUndoToast(text, { onUndo = () => {}, onCommit = () => {}, delayMs = 5000 } = {}) {
        let toast = document.getElementById('dc-undo-toast');
        if (toast) {
            clearTimeout(toast._timer);
            if (toast._onCommit) toast._onCommit();
        } else {
            toast = document.createElement('div');
            toast.id = 'dc-undo-toast';
            document.body.appendChild(toast);
        }

        toast.innerHTML = `
            <span class="dc-undo-toast-text"></span>
            <button class="dc-undo-toast-btn">Geri Al</button>
        `;
        toast.querySelector('.dc-undo-toast-text').textContent = text;
        toast.classList.add('show');

        toast._onCommit = onCommit;
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
            toast._onCommit = null;
            onCommit();
        }, delayMs);

        const undoBtn = toast.querySelector('.dc-undo-toast-btn');
        undoBtn.addEventListener('click', () => {
            clearTimeout(toast._timer);
            toast._onCommit = null;
            toast.classList.remove('show');
            onUndo();
        });
    }
    window.dcShowUndoToast = dcShowUndoToast;

    // ─── ÖZEL ONAY PENCERESİ (browser confirm() yerine) ─────────
    // confirmText/cancelText özelleştirilebilir, danger=true ise "onayla" butonu kırmızı olur
export function dcShowConfirm(opts) {
        const {
            title = 'Emin misin?',
            message = '',
            confirmText = 'Evet',
            cancelText = 'Vazgeç',
            danger = true,
            icon = (danger ? 'fa-trash-can' : 'fa-circle-question'),
            onConfirm = () => {}
        } = opts;

        document.querySelectorAll('.dc-confirm-modal-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'dc-confirm-modal-overlay';
        overlay.innerHTML = `
            <div class="dc-confirm-modal">
                <div class="dc-confirm-modal-icon${danger ? ' danger' : ''}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="dc-confirm-modal-title">${window._escapeHtml(title)}</div>
                <div class="dc-confirm-modal-message">${window._escapeHtml(message)}</div>
                <div class="dc-confirm-modal-actions">
                    <button class="dc-confirm-btn dc-confirm-cancel">${window._escapeHtml(cancelText)}</button>
                    <button class="dc-confirm-btn dc-confirm-ok${danger ? ' danger' : ''}">${window._escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 160);
        };

        overlay.querySelector('.dc-confirm-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.dc-confirm-ok').addEventListener('click', () => {
            close();
            onConfirm();
        });
    }
    window.dcShowConfirm = dcShowConfirm;

    // ─── MESAJ SİLME SEÇENEĞİ: "Herkesten Sil" / "Sadece Benden Sil" ────
    // 1 saatten eski mesajlarda "Herkesten Sil" seçeneği gösterilmez.
export const DC_DELETE_FOR_EVERYONE_LIMIT_MS = 60 * 60 * 1000; // 1 saat
    window.DC_DELETE_FOR_EVERYONE_LIMIT_MS = DC_DELETE_FOR_EVERYONE_LIMIT_MS; // social.js'in deleteDcMsg'i + social-dc-msg-selection.js için

export function dcShowDeleteChoice(opts) {
        const {
            title = 'Mesajı Sil',
            allowEveryone = true,
            onDeleteForMe = () => {},
            onDeleteForEveryone = () => {}
        } = opts;

        document.querySelectorAll('.dc-confirm-modal-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'dc-confirm-modal-overlay';
        overlay.innerHTML = `
            <div class="dc-confirm-modal">
                <div class="dc-confirm-modal-icon danger">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <div class="dc-confirm-modal-title">${window._escapeHtml(title)}</div>
                <div class="dc-confirm-modal-message">${allowEveryone ? 'Bu mesajı kimden silmek istersin?' : 'Bu mesaj 1 saatten eski olduğu için sadece kendi görünümünden silinebilir.'}</div>
                <div class="dc-confirm-modal-actions u-flex-direction-column_gap-8px" >
                    ${allowEveryone ? `<button class="dc-confirm-btn dc-confirm-ok danger u-width-100pct" data-action="everyone" >Herkesten Sil</button>` : ''}
                    <button class="dc-confirm-btn dc-confirm-ok u-width-100pct" data-action="me" >Sadece Benden Sil</button>
                    <button class="dc-confirm-btn dc-confirm-cancel u-width-100pct" data-action="cancel" >Vazgeç</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 160);
        };

        overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        const everyoneBtn = overlay.querySelector('[data-action="everyone"]');
        if (everyoneBtn) everyoneBtn.addEventListener('click', () => { close(); onDeleteForEveryone(); });
        overlay.querySelector('[data-action="me"]').addEventListener('click', () => { close(); onDeleteForMe(); });
    }
    window.dcShowDeleteChoice = dcShowDeleteChoice;

