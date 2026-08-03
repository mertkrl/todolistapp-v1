// ─── DC MESAJ RENDER ÇEKİRDEĞİ ─────────────────────────────────────────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). renderDcMessage
// dispatcher'ı + hover-actions/metin-gövde/reactions-bar alt-fonksiyonları.
// Paylaşılan DC sohbet state'i artık state/dc-message-render-store.js +
// state/dc-chat-view-store.js + state/current-user-store.js üzerinden okunuyor
// (gerçek getter/setter, bare closure değişkeni yok). _dcOtherLastRead sadece
// social.js'te kalan bir değişken olduğu için salt-okunur
// window.__getDcOtherLastRead() köprüsü kullanılıyor.
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getCurrentUser } from './state/current-user-store.js';
import { getDcCurrentMsgPath } from './state/dc-chat-view-store.js';
import {
    getDcMsgRegistry, getDcSelectedKeys, getDcCurrentRole
} from './state/dc-message-render-store.js';
import { initiateDcReply, openDcMsgReactionPicker, toggleDcMsgReaction } from './social-dc-reply-reactions.js';
import { dcRebuildDateSeparators } from './social-dc-online-status.js';
import { toggleDcPinMessage } from './social-message-pins.js';
import {
    _renderDcCwRoomInviteCard, _renderDcSystemJoinCard,
    _renderDcSystemNotice, _renderDcRoleChangeNotice
} from './social-dc-message-cards.js';
import { attachDcMsgAvatar, attachDcMsgSpacer } from './social-dc-msg-dom-helpers.js';
import { jumpToDcMsg } from './social-dc-scroll-utils.js';
import { _escapeHtml, _formatMessageText } from './social-misc-pure-utils.js';

const DC_MSG_GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 dakika

window.buildDcMsgHoverActions = buildDcMsgHoverActions;
export function buildDcMsgHoverActions(bubble, row, textEl, m, msgKey, isMe, isSelected) {
    const isGroup = getActiveChatTarget() && getActiveChatTarget().type === 'group';
    const isDm = getActiveChatTarget() && getActiveChatTarget().type === 'dm';
    const isAdminOrMod = isGroup && (getDcCurrentRole() === 'admin' || getDcCurrentRole() === 'moderator');
    const canModerate = !isMe && isAdminOrMod;
    const canPin = isDm || isAdminOrMod;
    const isPinned = !!window.isDcMsgPinned(msgKey);
    const actions = document.createElement('div');
    actions.className = 'dc-msg-hover-actions';
    actions.innerHTML = `
        <button class="dc-msg-action-btn" data-action="react" title="Tepki ekle" aria-label="Tepki ekle"><i class="fa-regular fa-face-smile"></i></button>
        <button class="dc-msg-action-btn" data-action="reply" title="Yanıtla" aria-label="Yanıtla"><i class="fa-solid fa-reply"></i></button>
        <button class="dc-msg-action-btn${isSelected ? ' is-selected' : ''}" data-action="select" title="Seç" aria-label="Seç">
            <i class="fa-${isSelected ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
        </button>
        ${canPin ? `
        <button class="dc-msg-action-btn${isPinned ? ' is-selected' : ''}" data-action="pin" title="${isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}"><i class="fa-solid fa-thumbtack"></i></button>
        ` : ''}
        ${isMe ? `
        <button class="dc-msg-action-btn" data-action="edit" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
        <button class="dc-msg-action-btn dc-msg-action-danger" data-action="delete" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
        ` : ''}
        ${canModerate ? `
        <button class="dc-msg-action-btn dc-msg-action-danger" data-action="mod-delete" title="Mesajı sil (moderatör)" aria-label="Mesajı sil (moderatör)"><i class="fa-solid fa-trash-can"></i></button>
        ` : ''}
    `;
    actions.querySelector('[data-action="react"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openDcMsgReactionPicker(actions.querySelector('[data-action="react"]'), bubble, msgKey, isMe);
    });
    actions.querySelector('[data-action="reply"]').addEventListener('click', (e) => {
        e.stopPropagation();
        initiateDcReply(m.displayName || m.username, m.text || m.decryptedText || '', msgKey);
    });
    actions.querySelector('[data-action="select"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.toggleDcMsgSelection(msgKey, row);
    });
    const pinBtn = actions.querySelector('[data-action="pin"]');
    if (pinBtn) pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDcPinMessage(msgKey, m);
    });
    const editBtn = actions.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.startDcMsgEdit(msgKey, row, textEl, m);
    });
    const deleteBtn = actions.querySelector('[data-action="delete"]');
    if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteDcMsg(msgKey, row);
    });
    const modDeleteBtn = actions.querySelector('[data-action="mod-delete"]');
    if (modDeleteBtn) modDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteDcMsg(msgKey, row, { forceAllowEveryone: true });
    });
    bubble.appendChild(actions);
}

// Mesaj balonunun metin gövdesini doldurur — düz metin, mention vurgusu ve şifreli
// mesaj çözme akışının hepsi burada. row/myUsername/isMe encryption dalı için gerekiyor.
window.fillDcMsgTextBody = fillDcMsgTextBody;
export function fillDcMsgTextBody(textEl, row, m, myUsername, isMe) {
    const appendEditedTag = () => {
        if (!m.edited) return;
        const editedTag = document.createElement('span');
        editedTag.className = 'dc-msg-edited-tag';
        editedTag.textContent = ' (düzenlendi)';
        editedTag.title = 'Düzenleme geçmişini gör';
        editedTag.style.cursor = 'pointer';
        textEl.appendChild(editedTag);
    };

    if (m.enc) {
        // Şifreli mesaj — çözülene kadar satırı gizle. Çözülemezse (anahtar bu
        // cihazda yok, kurtarılamaz) satır tamamen kaldırılır; boş baloncuk veya
        // uyarı metni gösterilmez.
        row.style.display = 'none';
        const otherUsername = m.username === myUsername
            ? (getActiveChatTarget() && getActiveChatTarget().username)
            : m.username;
        const dropRow = () => {
            const parent = row.parentElement;
            row.remove();
            if (parent && parent.classList && parent.classList.contains('dc-messages-stream')) {
                dcRebuildDateSeparators(parent);
            }
        };
        if (otherUsername) {
            window.decryptDmText(otherUsername, m.enc).then(plain => {
                if (plain !== null) {
                    textEl.innerHTML = _formatMessageText(plain);
                    m.decryptedText = plain;
                    appendEditedTag();
                    row.style.display = 'flex';
                } else {
                    dropRow();
                }
            });
        } else {
            dropRow();
        }
    } else {
        textEl.innerHTML = _formatMessageText(m.text);
        if (Array.isArray(m.mentions) && m.mentions.length) {
            let html = textEl.innerHTML;
            m.mentions.forEach(uname => {
                const safe = uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp('@' + safe + '\\b', 'gi');
                const isMentionedMe = uname === myUsername;
                html = html.replace(re, `<span class="dc-mention${isMentionedMe ? ' is-me' : ''}">@${_escapeHtml(uname)}</span>`);
            });
            textEl.innerHTML = html;
        }
        appendEditedTag();
    }
    textEl.style.background = isMe ? 'var(--dc-bubble-me-bg, rgba(108,92,231,0.35))' : 'rgba(255,255,255,0.07)';
    textEl.style.border = `1px solid ${isMe ? 'var(--dc-bubble-me-border, rgba(108,92,231,0.3))' : 'rgba(255,255,255,0.06)'}`;
    textEl.style.padding = '7px 11px';
    textEl.style.borderRadius = isMe ? 'var(--dc-bubble-radius-me, 12px 4px 12px 12px)' : 'var(--dc-bubble-radius-other, 4px 12px 12px 12px)';
    textEl.style.fontSize = 'var(--dc-msg-font-size, 13px)';
    textEl.style.fontFamily = 'var(--dc-msg-font-family, inherit)';
    textEl.style.color = '#fff';
    textEl.style.lineHeight = '1.5';
    textEl.style.wordBreak = 'break-word';
    // Sadece metin varsa bubble'ı göster, yoksa gizle
    if (!m.text && !m.enc) textEl.style.display = 'none';
}

window.buildDcMsgReactionsBar = buildDcMsgReactionsBar;
export function buildDcMsgReactionsBar(bubble, m, msgKey, myUsername) {
    const reactionsBar = document.createElement('div');
    reactionsBar.className = 'dc-msg-reactions';
    const counts = {};
    Object.entries(m.reactions).forEach(([uname, emoji]) => {
        if (!emoji) return;
        (counts[emoji] = counts[emoji] || []).push(uname);
    });
    Object.entries(counts).forEach(([emoji, users]) => {
        const mine = users.includes(myUsername);
        const pill = document.createElement('button');
        pill.className = `dc-msg-reaction-pill${mine ? ' is-mine' : ''}`;
        pill.innerHTML = `<span>${_escapeHtml(emoji)}</span><span class="dc-msg-reaction-count">${users.length}</span>`;
        pill.title = users.join(', ');
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDcMsgReaction(msgKey, emoji);
        });
        reactionsBar.appendChild(pill);
    });
    bubble.appendChild(reactionsBar);
}

window.renderDcMessage = renderDcMessage;
export function renderDcMessage(container, m, myUsername, msgKey, opts) {
    // Özel kart/sistem mesajı türleri — her biri kendi fonksiyonuna taşındı,
    // normal mesaj render mantığından ayrı tutuluyor (bkz. Faz 2 refactor).
    if (m.type === 'cw_room_invite') { _renderDcCwRoomInviteCard(container, m, msgKey); return; }
    if (m.type === 'system_join_card') { _renderDcSystemJoinCard(container, m); return; }
    if (m.type === 'system_join' || m.type === 'system_leave' || m.type === 'system') { _renderDcSystemNotice(container, m); return; }
    if (m.type === 'system_promote' || m.type === 'system_demote') { _renderDcRoleChangeNotice(container, m); return; }

    // undefined text kontrolü — boş mesajları atla (şifreli mesajların 'enc' alanı vardır)
    if (!m.text && !m.enc) return;
    const isMe = m.username === myUsername;
    const timeStr = m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    // Aynı kişinin, kısa süre içindeki art arda mesajları için compact (gruplu) görünüm
    const lastMsg = container.lastElementChild;
    const lastUser = lastMsg ? lastMsg.dataset.username : null;
    const lastTimestamp = lastMsg ? parseInt(lastMsg.dataset.timestamp || '0', 10) : 0;
    const withinGroupWindow = lastTimestamp && m.timestamp && (m.timestamp - lastTimestamp) < DC_MSG_GROUP_WINDOW_MS;
    const compact  = lastUser === m.username && withinGroupWindow;

    if (msgKey) getDcMsgRegistry()[msgKey] = m;
    const isSelected = !!msgKey && getDcSelectedKeys().has(msgKey);

    const row = document.createElement('div');
    row.dataset.username = m.username;
    if (msgKey) row.dataset.msgKey = msgKey;
    row.dataset.timestamp = m.timestamp || '';
    row.className = `dc-dm-msg-row ${isMe ? 'msg-me' : 'msg-other'}${isSelected ? ' dc-msg-selected' : ''}${opts && opts.animate ? ' dc-msg-animate-in' : ''}`;
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '10px';
    row.style.padding = compact ? '1px 0' : '6px 0 2px';
    row.style.flexDirection = isMe ? 'row-reverse' : 'row';

    if (!compact) {
        attachDcMsgAvatar(row, m);
    } else {
        attachDcMsgSpacer(row, timeStr);
    }

    const bubble = document.createElement('div');
    bubble.className = 'dc-msg-bubble';
    bubble.style.position = 'relative';
    bubble.style.maxWidth = '68%';
    bubble.style.display = 'flex';
    bubble.style.flexDirection = 'column';
    bubble.style.alignItems = isMe ? 'flex-end' : 'flex-start';

    // textEl burada (boş) oluşturulur ki aşağıdaki hover-actions'ın Düzenle butonu ona
    // referans verebilsin — gerçek içeriği/DOM'a eklenmesi fonksiyonun ilerisinde olur,
    // sıralama (appendChild çağrı sırası) değişmedi, sadece değişken bildirimi öne alındı.
    const textEl = document.createElement('div');
    textEl.className = 'dc-msg-text';

    // Yanıtla / Tepki / Seç / Düzenle / Sil hover butonları
    if (msgKey) {
        buildDcMsgHoverActions(bubble, row, textEl, m, msgKey, isMe, isSelected);
    }

    if (m.forwardedFrom) {
        const fwdEl = document.createElement('div');
        fwdEl.style.fontSize = '10px';
        fwdEl.style.color = 'rgba(255,255,255,0.35)';
        fwdEl.style.display = 'flex';
        fwdEl.style.alignItems = 'center';
        fwdEl.style.gap = '4px';
        fwdEl.style.marginBottom = '2px';
        fwdEl.innerHTML = `<i class="fa-solid fa-share"></i> İletildi · ${_escapeHtml(m.forwardedFrom)}`;
        bubble.appendChild(fwdEl);
    }

    if (!compact) {
        const meta = document.createElement('div');
        meta.className = 'dc-msg-meta';
        meta.style.display = 'flex';
        meta.style.alignItems = 'baseline';
        meta.style.gap = '6px';
        meta.style.marginBottom = '3px';
        meta.style.flexWrap = 'wrap';
        // Rol rozeti: sadece öğretmen ve admin için göster
        const currentUser = getCurrentUser();
        const senderRole = isMe ? (currentUser?.institutionRole || 'member') : (m.institutionRole || 'member');
        let roleBadgeHtml = '';
        if (senderRole === 'teacher') {
            roleBadgeHtml = '<span class="dc-role-badge dc-role-teacher" title="Öğretmen"><i class="fa-solid fa-chalkboard-user"></i> Öğretmen</span>';
        } else if (senderRole === 'admin') {
            roleBadgeHtml = '<span class="dc-role-badge dc-role-admin" title="Yönetici"><i class="fa-solid fa-shield-halved"></i> Yönetici</span>';
        }
        meta.innerHTML = `
            <span class="dc-msg-sender-name u-font-size-12px_font-weight-600_cursor-pointer" title="Profili Gör">${_escapeHtml(m.displayName || m.username)}</span>
            ${roleBadgeHtml}
            <span class="u-font-size-10px_color-rgba2552552550p25">${timeStr}</span>
        `;
        meta.querySelector('.dc-msg-sender-name').style.color = isMe ? 'var(--dc-accent, #a29bfe)' : '#fff';
        meta.querySelector('.dc-msg-sender-name').addEventListener('click', (e) => {
            e.stopPropagation();
            window.openMiniProfile(m.username, { displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, e.currentTarget);
        });
        bubble.appendChild(meta);
    }

    if (m.replyTo) {
        const rText = m.replyTo.text || m.replyTo.decryptedText || '';
        const replyEl = document.createElement('div');
        replyEl.className = 'chat-reply-quote';
        replyEl.style.background = 'rgba(108,92,231,0.12)';
        replyEl.style.borderLeft = '3px solid var(--primary-color)';
        replyEl.style.padding = '5px 10px';
        replyEl.style.fontSize = '11px';
        replyEl.style.color = '#a4b0be';
        replyEl.style.borderRadius = '6px';
        replyEl.style.marginBottom = '4px';
        replyEl.style.maxWidth = '100%';
        replyEl.style.overflow = 'hidden';
        replyEl.style.textOverflow = 'ellipsis';
        replyEl.style.whiteSpace = 'nowrap';
        replyEl.innerHTML = `<span class="u-color-var-primary-color_font-weight-700">↩ ${_escapeHtml(m.replyTo.sender)}</span><span class="u-margin-left-4px_opacity-0p8">${_escapeHtml(rText.length > 40 ? rText.slice(0, 40) + '…' : rText)}</span>`;
        if (m.replyTo.msgKey) {
            replyEl.style.cursor = 'pointer';
            replyEl.title = 'Orijinal mesaja git';
            replyEl.addEventListener('click', (e) => {
                e.stopPropagation();
                jumpToDcMsg(m.replyTo.msgKey);
            });
        }
        bubble.appendChild(replyEl);
    }

    fillDcMsgTextBody(textEl, row, m, myUsername, isMe);
    bubble.appendChild(textEl);

    // Dosya ekleri
    if (Array.isArray(m.attachments) && m.attachments.length && window.FocusChat?.renderAttachment) {
        m.attachments.forEach(att => {
            const attEl = window.FocusChat.renderAttachment(att);
            if (attEl) bubble.appendChild(attEl);
        });
    }

    // Anket kartı
    if (m.pollId && window.FocusChat?.renderPollCard) {
        const pollContainer = document.createElement('div');
        bubble.appendChild(pollContainer);
        window.FocusChat.renderPollCard(m.pollId, pollContainer);
    }

    // Tepki (reaksiyon) pilleri
    if (msgKey && m.reactions && Object.keys(m.reactions).length) {
        buildDcMsgReactionsBar(bubble, m, msgKey, myUsername);
    }

    // Okundu bilgisi (sadece kendi mesajlarımızda, DM'de)
    if (isMe && msgKey && getActiveChatTarget() && getActiveChatTarget().type === 'dm') {
        const otherLastRead = window.__getDcOtherLastRead ? window.__getDcOtherLastRead() : 0;
        const seen = (m.timestamp || 0) <= otherLastRead;
        const receipt = document.createElement('span');
        receipt.className = `dc-read-receipt ${seen ? 'seen' : 'sent'}`;
        receipt.dataset.msgKey = msgKey;
        receipt.innerHTML = `<i class="fa-solid ${seen ? 'fa-check-double' : 'fa-check'}"></i>`;
        bubble.appendChild(receipt);
    }

    row.appendChild(bubble);

    // Seçim modu aktifken satıra tıklamak da seçimi değiştirsin
    if (msgKey) {
        row.addEventListener('click', () => {
            if (window.__getDcSelectedKeys().size > 0) window.toggleDcMsgSelection(msgKey, row);
        });
    }

    container.appendChild(row);
}
