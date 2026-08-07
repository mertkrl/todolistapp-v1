// social-server-tree-context-menu.js
// social-server-tree.js'ten çıkarıldı: kanal ⋮ context menüsü + inline
// yeniden adlandırma. Tamamen izole — sadece kendi parametrelerine ve
// window.isChatMuted/toggleChatMuted/_escapeHtml globallerine bağımlı.
import { isChatMuted, toggleChatMuted } from './social-chat-list-actions.js';
import { _escapeHtml } from './social-misc-pure-utils.js';

export function openChannelContextMenu(anchorEl, opts) {
    document.querySelectorAll('.ch-ctx-menu').forEach(m => m.remove());
    const esc = _escapeHtml;

    const menu = document.createElement('div');
    menu.className = 'ch-ctx-menu';

    const items = [];
    // Sessize Al — her kanal/odada göster
    if (opts.chatPath !== undefined) {
        const muted = typeof window.isChatMuted === 'function' && isChatMuted(opts.chatPath);
        items.push({
            icon: muted ? 'fa-bell' : 'fa-bell-slash',
            label: muted ? 'Bildirimleri Aç' : 'Sessize Al',
            cls: 'item-mute',
            action: () => {
                if (typeof window.toggleChatMuted === 'function') toggleChatMuted(opts.chatPath);
                // Kanal satırındaki ikonunu da güncelle
                if (opts.muteIconEl) {
                    const nowMuted = typeof window.isChatMuted === 'function' && isChatMuted(opts.chatPath);
                    opts.muteIconEl.className = `fa-solid ${nowMuted ? 'fa-bell-slash' : 'fa-bell'}`;
                }
            }
        });
    }
    if (opts.canRename !== false && opts.onRename) {
        items.push({ icon: 'fa-pen-to-square', label: 'Yeniden Adlandır', cls: 'item-rename', action: opts.onRename });
    }
    if (opts.canLock) {
        items.push({
            icon: opts.isLocked ? 'fa-lock-open' : 'fa-lock',
            label: opts.isLocked ? 'Kilidi Aç' : 'Odayı Kilitle',
            cls: 'item-lock',
            action: opts.onLock
        });
    }
    if (opts.canAnnouncement) {
        items.push({
            icon: opts.isAnnouncement ? 'fa-people-group' : 'fa-bullhorn',
            label: opts.isAnnouncement ? 'Normal Odaya Dönüştür' : 'Duyuru Kanalı Yap',
            cls: 'item-announcement',
            action: opts.onAnnouncement
        });
    }
    if (opts.canPerm) {
        items.push({ icon: 'fa-sliders', label: 'İzin İstisnaları', cls: 'item-perm', action: opts.onPerm });
    }
    if (opts.canDelete) {
        items.push({ icon: 'fa-trash-can', label: opts.type === 'category' ? 'Kategoriyi Sil' : 'Odayı Sil', cls: 'item-delete', action: opts.onDelete });
    }

    menu.innerHTML = items.map(it => `
        <button class="ch-ctx-item ${it.cls}">
            <span class="ch-ctx-icon"><i class="fa-solid ${it.icon}"></i></span>
            ${it.label}
        </button>
    `).join('');

    document.body.appendChild(menu);

    const rect = anchorEl.getBoundingClientRect();
    const menuW = 180;
    let left = rect.right + 6;
    if (left + menuW > window.innerWidth - 8) left = rect.left - menuW - 6;
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top  = Math.max(8, rect.top) + 'px';

    requestAnimationFrame(() => menu.classList.add('ch-ctx-menu--open'));

    const close = () => {
        menu.classList.remove('ch-ctx-menu--open');
        setTimeout(() => menu.remove(), 160);
    };
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);

    items.forEach((it, i) => {
        menu.querySelectorAll('.ch-ctx-item')[i]?.addEventListener('click', (e) => {
            e.stopPropagation();
            close();
            it.action && it.action();
        });
    });
}

// ─── INLINE RENAME (isim üzerinde düzenleme) ──────────
export function openInlineRename(spanEl, currentName, onSave) {
    if (!spanEl) return;
    const originalText = spanEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'ch-inline-rename-input';
    spanEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = async () => {
        const newName = input.value.trim();
        input.replaceWith(spanEl);
        if (newName && newName !== currentName) {
            spanEl.textContent = newName;
            await onSave(newName);
        } else {
            spanEl.textContent = originalText;
        }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = currentName; input.blur(); }
    });
}
