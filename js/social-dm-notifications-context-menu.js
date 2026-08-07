import { isChatPinned, toggleChatPinned, isChatMuted, toggleChatMuted, removeRecentConvo } from './social-chat-list-actions.js';

// Bir "Son Mesajlaşmalar" satırına sağ tıklayınca açılan Sabitle/Sessize Al menüsü
export function showRecentConvoContextMenu(e, username, displayName, key, type) {
    document.querySelectorAll('.dc-convo-context-menu').forEach(el => el.remove());

    const isGroup = type === 'group';
    const pinned = !isGroup && isChatPinned(username);
    const muted  = !isGroup && isChatMuted(username);

    const menu = document.createElement('div');
    menu.className = 'dc-convo-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    menu.innerHTML = `
        ${isGroup ? '' : `
        <button data-action="pin"><i class="fa-solid fa-thumbtack"></i> ${pinned ? 'Sabitlemeyi Kaldır' : 'Sohbeti Sabitle'}</button>
        <button data-action="mute"><i class="fa-solid ${muted ? 'fa-bell' : 'fa-bell-slash'}"></i> ${muted ? 'Bildirimleri Aç' : 'Bildirimleri Sessize Al'}</button>
        `}
        <button data-action="remove"><i class="fa-solid fa-xmark"></i> Kaldır</button>
    `;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="pin"]')?.addEventListener('click', () => {
        toggleChatPinned(username);
        menu.remove();
    });
    menu.querySelector('[data-action="mute"]')?.addEventListener('click', () => {
        toggleChatMuted(username);
        menu.remove();
    });
    menu.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        removeRecentConvo(key);
        menu.remove();
    });

    const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}
