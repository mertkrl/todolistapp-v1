import { getCurrentUser } from '../state/current-user-store.js';

export function _escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window._escapeHtml = _escapeHtml;

export function _formatMessageText(str) {
    let s = _escapeHtml(str);
    s = s.replace(/`([^`\n]+)`/g, '<code class="chat-inline-code">$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-msg-link">$1</a>');
    return s;
}
window._formatMessageText = _formatMessageText;

export function _dcCreatePendingBubble(streamEl, text) {
    const currentUser = getCurrentUser();
    const row = document.createElement('div');
    row.className = 'dc-dm-msg-row msg-me dc-msg-pending-row';
    row.dataset.username = currentUser?.username || '';
    row.dataset.timestamp = String(Date.now());
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '10px';
    row.style.padding = '6px 0 2px';
    row.style.flexDirection = 'row-reverse';

    const spacer = document.createElement('div');
    spacer.style.width = '32px';
    spacer.style.flexShrink = '0';
    row.appendChild(spacer);

    const bubble = document.createElement('div');
    bubble.className = 'dc-msg-bubble';
    bubble.style.maxWidth = '68%';
    bubble.style.display = 'flex';
    bubble.style.flexDirection = 'column';
    bubble.style.alignItems = 'flex-end';
    bubble.style.opacity = '0.72';

    const textEl = document.createElement('div');
    textEl.className = 'dc-msg-text';
    textEl.innerHTML = _formatMessageText(text);
    bubble.appendChild(textEl);

    const statusEl = document.createElement('div');
    statusEl.className = 'dc-msg-pending-status';
    statusEl.style.fontSize = '10.5px';
    statusEl.style.color = 'rgba(255,255,255,0.4)';
    statusEl.style.marginTop = '2px';
    statusEl.style.display = 'flex';
    statusEl.style.alignItems = 'center';
    statusEl.style.gap = '4px';
    statusEl.innerHTML = '<i class="fa-solid fa-clock u-font-size-9px" ></i> Gönderiliyor…';
    bubble.appendChild(statusEl);

    row.appendChild(bubble);
    streamEl.appendChild(row);
    streamEl.scrollTop = streamEl.scrollHeight;
    return { row, statusEl };
}
window._dcCreatePendingBubble = _dcCreatePendingBubble;

export function generateGroupCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
window.generateGroupCode = generateGroupCode;

export function dcAvatar(name, color) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'U')}&background=${color||'6c5ce7'}&color=fff`;
}
window.dcAvatar = dcAvatar;

export function getDB() { return null; }
window.getDB = getDB;

export function getUser() {
    try { return JSON.parse(localStorage.getItem('focusai_social_user'), window._safeJsonReviver); } catch { return null; }
}
window.getUser = getUser;

export function _pickNewOwner(members, groupName) {
    return new Promise(resolve => {
        const esc = window.escapeHtml;
        const overlay = document.createElement('div');
        overlay.className = 'focusai-confirm-overlay';
        overlay.innerHTML = `
            <div class="focusai-confirm-box">
                <div class="focusai-confirm-icon danger"><i class="fa-solid fa-door-open"></i></div>
                <div class="focusai-confirm-title">Gruptan Ayrıl</div>
                <div class="focusai-confirm-desc">
                    <b>"${esc(groupName)}"</b> grubunun sahibisiniz. Devam etmeden önce, sahipliği devretmek istediğiniz üyeyi seçin:
                </div>
                <select id="_pno_select" class="gsc-form-input u-width-100pct_margin-12px0_box-sizing-border-box" >
                    ${members.map(m => `<option value="${m.user_id}">${esc((m.profiles && (m.profiles.display_name || m.profiles.username)) || '?')}</option>`).join('')}
                </select>
                <div class="focusai-confirm-actions">
                    <button class="focusai-confirm-btn cancel" id="_pno_cancel">Vazgeç</button>
                    <button class="focusai-confirm-btn confirm-danger" id="_pno_confirm">Devret ve Ayrıl</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = (val) => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.15s';
            setTimeout(() => overlay.remove(), 150);
            resolve(val);
        };
        overlay.querySelector('#_pno_confirm').addEventListener('click', () => {
            close(overlay.querySelector('#_pno_select')?.value || null);
        });
        overlay.querySelector('#_pno_cancel').addEventListener('click', () => close(null));
        overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    });
}
window._pickNewOwner = _pickNewOwner;
