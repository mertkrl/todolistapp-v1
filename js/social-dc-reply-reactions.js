// ─── YANITLA ÖNİZLEME ÇUBUĞU + MESAJ TEPKİLERİ (REACTIONS) ───────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Bu 4 fonksiyon
// coworking-room state'ine (currentRoomId/_cwRoomSupaChannel/vb.) hiç
// dokunmuyor; DC sohbet state'inden sadece zaten köprülenmiş
// getDcReplyTo/setDcReplyTo (state/dc-chat-view-store.js) ve salt-okunur
// window.__getDcCurrentGroupScope/__getDcCurrentConversation/__getDcMsgRegistry
// köprülerini (social.js içinde tanımlı, o dosyada hâlâ yazılıyor) kullanıyor.
import { setDcReplyTo } from '../state/dc-chat-view-store.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { _escapeHtml, getDB, getUser } from './social-misc-pure-utils.js';
import { closeReactionPicker } from './social-activity-feed.js';
import { DC_EMOJI_GROUPS } from './social-emoji-picker.js';
import { _throttleAction } from './social-throttle-and-date-utils.js';
import { getActiveReactionPicker, setActiveReactionPicker } from '../state/active-reaction-picker-store.js';
import { getDcCurrentMsgPath } from '../state/dc-chat-view-store.js';
import { getDcCurrentGroupScope } from '../state/dc-current-group-scope-store.js';

window.initiateDcReply = initiateDcReply;
export function initiateDcReply(sender, text, msgKey) {
    setDcReplyTo(msgKey ? { sender, text, msgKey } : { sender, text });
    const inputEl = document.getElementById('sidebar-chat-message-input');
    const inputWrap = inputEl ? inputEl.closest('.dc-chat-input-bar') : null;
    if (!inputWrap) return;

    let replyBar = document.getElementById('sidebar-chat-reply-preview-bar');
    if (!replyBar) {
        replyBar = document.createElement('div');
        replyBar.id = 'sidebar-chat-reply-preview-bar';
        inputWrap.insertBefore(replyBar, inputWrap.firstChild);
    }
    replyBar.className = 'chat-reply-bar-active';
    replyBar.style.display = '';
    replyBar.innerHTML = `
        <div class="chat-reply-bar-inner">
            <i class="fa-solid fa-reply chat-reply-bar-icon"></i>
            <div class="chat-reply-bar-text">
                <span class="chat-reply-bar-name">@${_escapeHtml(sender)}</span>
                <span class="chat-reply-bar-preview">${_escapeHtml(text.length > 50 ? text.slice(0, 50) + '…' : text)}</span>
            </div>
            <button class="chat-reply-bar-close" data-action="cancel-reply" aria-label="Yanıtlamayı iptal et"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    replyBar.querySelector('[data-action="cancel-reply"]').addEventListener('click', cancelDcReply);
    inputEl?.focus();
}

window.cancelDcReply = cancelDcReply;
export function cancelDcReply() {
    setDcReplyTo(null);
    const replyBar = document.getElementById('sidebar-chat-reply-preview-bar');
    if (replyBar) replyBar.style.display = 'none';
}

window.openDcMsgReactionPicker = openDcMsgReactionPicker;
export function openDcMsgReactionPicker(triggerBtn, bubbleEl, msgKey, isMe) {
    closeReactionPicker();

    const picker = document.createElement('div');
    picker.className = 'activity-reaction-picker dc-msg-reaction-picker dc-emoji-popover dc-msg-reaction-picker-full';
    picker.innerHTML = Object.entries(DC_EMOJI_GROUPS).map(([label, emojis]) => `
        <div class="dc-emoji-popover-group-label">${label}</div>
        <div class="dc-emoji-popover-grid">
            ${emojis.map(e => `<button type="button" class="dc-emoji-popover-btn" data-emoji="${e}">${e}</button>`).join('')}
        </div>
    `).join('');
    picker.style[isMe ? 'right' : 'left'] = '0';
    picker.style[isMe ? 'left' : 'right'] = 'auto';

    bubbleEl.appendChild(picker);
    requestAnimationFrame(() => picker.classList.add('is-open'));

    picker.querySelectorAll('.dc-emoji-popover-btn').forEach(emojiBtn => {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDcMsgReaction(msgKey, emojiBtn.dataset.emoji);
            closeReactionPicker();
        });
    });

    setActiveReactionPicker({ picker, outsideHandler: null });
    const outsideHandler = (e) => {
        if (!picker.contains(e.target) && e.target !== triggerBtn) closeReactionPicker();
    };
    getActiveReactionPicker().outsideHandler = outsideHandler;
    setTimeout(() => document.addEventListener('click', outsideHandler), 0);
}

window.toggleDcMsgReaction = toggleDcMsgReaction;
export function toggleDcMsgReaction(msgKey, emoji) {
    const user = getUser();
    if (!user || !msgKey) return;
    // Aynı mesaja hızlı ardışık tepki ver/kaldır spamini engelle
    if (!_throttleAction(`dc_reaction_${msgKey}`, 600)) return;

    const currentUser = getCurrentUser();
    // Supabase DM/grup mesajları: message_reactions tablosu
    const groupScope = getDcCurrentGroupScope();
    const conversation = window.__getDcCurrentConversation ? window.__getDcCurrentConversation() : null;
    const scope = groupScope || (conversation ? { type: 'dm', id: conversation.id } : null);
    if (scope && window.FocusSupabase && currentUser?.id) {
        const registry = window.__getDcMsgRegistry ? window.__getDcMsgRegistry() : {};
        const existing = (registry[msgKey]?.reactions || {})[user.username];
        if (existing === emoji) {
            window.FocusSupabase.from('message_reactions').delete()
                .eq('message_id', msgKey).eq('user_id', currentUser.id)
                .then(({ error }) => { if (error) console.error('[Tepki] kaldırma hatası', error); });
        } else {
            window.FocusSupabase.from('message_reactions').upsert({
                message_id: msgKey,
                user_id: currentUser.id,
                scope_type: scope.type,
                scope_id: scope.id,
                emoji
            }).then(({ error }) => { if (error) console.error('[Tepki] ekleme hatası', error); });
        }
        return;
    }

    const database = getDB();
    if (!database || !getDcCurrentMsgPath()) return;
    const ref = database.ref(`${getDcCurrentMsgPath()}/${msgKey}/reactions/${user.username}`);
    ref.once('value').then(snap => {
        if (snap.val() === emoji) ref.remove();
        else ref.set(emoji);
    });
}
