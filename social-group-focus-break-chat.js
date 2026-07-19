// ─── GRUP ODAK OVERLAY — MOLA SOHBETİ ─────────────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — yüksek risk grubu).
// Hem "oda" (cw_rooms/.../chat) hem "meydan okuma" (challenges/.../break_chat)
// kaynaklarını aynı gf-break-chat arayüzüne bağlar.
//
// Dış bağımlılıklar salt-okunur köprülerle çözüldü:
// - currentUser → window._dcGetChatContext().currentUser (social.js'te tanımlı,
//   burada hiç yazılmıyor)
// - _cwRoomSupaChannel → window._cwGetRoomChannel() (social.js'te tanımlı,
//   burada hiç yazılmıyor — sadece ch.send() için okunuyor)
// - _escapeHtml → window.escapeHtml (storage-manager.js, zaten global)
// - _throttleAction → window._throttleAction (zaten köprülüydü)
//
// gfBreakChatPath dışarıdan (openSharedFocusOverlay/closeGroupFocusOverlay,
// social.js'te kalıyor) YAZILIYOR — bu yüzden window.gfSetBreakChatPath()
// setter'ı eklendi (gfIsRunning/gfSetRunning ile aynı desen).
let gfBreakChatRef = null;
let gfBreakChatPath = null; // { ref: 'cw_rooms'|'challenge', path }

function gfSetBreakChatPath(path) {
    gfBreakChatPath = path;
}
window.gfSetBreakChatPath = gfSetBreakChatPath;

function gfAppendChatMessage(msg) {
    const msgsEl = document.getElementById('gf-break-chat-messages');
    if (!msgsEl || !msg) return;
    const emptyEl = msgsEl.querySelector('.cws-bc-empty');
    if (emptyEl) emptyEl.remove();
    const currentUser = window._dcGetChatContext().currentUser;
    const senderName = msg.fromName || msg.sender || msg.from || '';
    const myName = currentUser?.displayName || currentUser?.username || '';
    const mine = (msg.from && msg.from === currentUser?.username) || (!msg.from && msg.sender === myName);
    const div = document.createElement('div');
    div.className = 'cws-bc-msg' + (mine ? ' mine' : '');
    const safeName = window.escapeHtml(senderName);
    const safeText = window.escapeHtml(String(msg.text || ''));
    div.innerHTML = mine
        ? `<span class="cws-bc-text">${safeText}</span>`
        : `<span class="cws-bc-name">${safeName}</span><span class="cws-bc-text">${safeText}</span>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
}
window.gfAppendChatMessage = gfAppendChatMessage;

let gfBcSavedPos = null; // { top, left } — kullanıcının bıraktığı konum

function gfAlignBreakChat() {
    const chatEl = document.getElementById('gf-break-chat');
    if (!chatEl) return;
    // Kullanıcı daha önce manuel konumlandırdıysa o konuma dön
    if (gfBcSavedPos) {
        chatEl.style.top  = gfBcSavedPos.top  + 'px';
        chatEl.style.left = gfBcSavedPos.left + 'px';
        chatEl.style.right = 'auto';
        chatEl.style.transform = 'none';
        return;
    }
    // İlk açılış: görev seçicinin altında, biraz daha aşağıda
    const selectorEl = document.getElementById('gf-active-task-selector');
    if (!selectorEl) return;
    const rect = selectorEl.getBoundingClientRect();
    const top = rect.bottom + 80;
    const left = window.innerWidth - chatEl.offsetWidth;
    chatEl.style.top  = top  + 'px';
    chatEl.style.left = left + 'px';
    chatEl.style.right = 'auto';
    chatEl.style.transform = 'none';
}
window.gfAlignBreakChat = gfAlignBreakChat;

let _gfBcSupaChannel = null; // Supabase mola sohbeti realtime kanalı

function gfToggleBreakChat(show) {
    const chatEl = document.getElementById('gf-break-chat');
    if (!chatEl) return;

    if (gfBreakChatPath && gfBreakChatPath.ref === 'focus_session_supabase') {
        // Mola sohbeti: _cwSupaChannel üzerinden broadcast kullanıyoruz
        // (DB yerine broadcast — RLS/migration bağımlılığı yok, mesajlar anlık iletilir)
        if (show) {
            gfAlignBreakChat();
            chatEl.classList.add('visible');
            // Mesaj geçmişi sadece mevcut oturum boyunca bellekte tutulur
            // (broadcast geçmişi yok, sayfa yenilenince sıfırlanır — bu beklenen davranış)
        } else {
            chatEl.classList.remove('visible');
            const msgsEl = document.getElementById('gf-break-chat-messages');
            if (msgsEl) msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola başladığında sohbet açılır</div>';
        }
        return;
    }

    if (show) {
        gfAlignBreakChat();
        chatEl.classList.add('visible');
    } else {
        chatEl.classList.remove('visible');
        if (gfBreakChatRef) { gfBreakChatRef.off(); gfBreakChatRef = null; }
        const msgsEl = document.getElementById('gf-break-chat-messages');
        if (msgsEl) msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola başladığında sohbet açılır</div>';
    }
}
window.gfToggleBreakChat = gfToggleBreakChat;

function gfSendBreakMessage() {
    const input = document.getElementById('gf-break-msg-input');
    const currentUser = window._dcGetChatContext().currentUser;
    if (!input || !input.value.trim() || !gfBreakChatPath || !currentUser) return;
    if (!window._throttleAction(`break_chat_send_${currentUser.username}`, 500)) return;

    if (gfBreakChatPath.ref === 'focus_session_supabase') {
        // Broadcast üzerinden gönder — oda modu kanalı
        const ch = window._cwGetRoomChannel();
        if (!ch) return;
        const text = input.value.trim().slice(0, 240);
        const displayName = currentUser?.displayName || currentUser?.username || 'Kullanıcı';
        gfAppendChatMessage({ from: currentUser?.username, fromName: displayName, text });
        ch.send({ type: 'broadcast', event: 'break_chat_msg',
            payload: { text, displayName, senderId: currentUser?.id } });
        input.value = '';
        return;
    }

    input.value = '';
}
window.gfSendBreakMessage = gfSendBreakMessage;

let gfBreakChatBound = false;
function gfEnsureBreakChatBindings() {
    if (gfBreakChatBound) return;
    gfBreakChatBound = true;
    const input = document.getElementById('gf-break-msg-input');
    const sendBtn = document.getElementById('gf-break-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', gfSendBreakMessage);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') gfSendBreakMessage(); });

    // ── Sürükleme (mouse + touch) ──
    const chatEl = document.getElementById('gf-break-chat');
    const handle = document.getElementById('gf-bc-drag-handle');
    if (chatEl && handle) {
        let dragging = false, ox = 0, oy = 0;

        function startDrag(clientX, clientY) {
            if (chatEl.classList.contains('gf-bc-minimized')) return;
            dragging = true;
            chatEl.classList.add('gf-bc-dragging');
            const rect = chatEl.getBoundingClientRect();
            ox = clientX - rect.left;
            oy = clientY - rect.top;
        }
        function moveDrag(clientX, clientY) {
            if (!dragging) return;
            let x = clientX - ox;
            let y = clientY - oy;
            x = Math.max(0, Math.min(window.innerWidth  - chatEl.offsetWidth,  x));
            y = Math.max(0, Math.min(window.innerHeight - chatEl.offsetHeight, y));
            chatEl.style.left = x + 'px';
            chatEl.style.top  = y + 'px';
            chatEl.style.right = 'auto';
            chatEl.style.transform = 'none';
        }
        function endDrag() {
            if (!dragging) return;
            dragging = false;
            chatEl.classList.remove('gf-bc-dragging');
            // Konumu kaydet
            gfBcSavedPos = {
                top:  parseFloat(chatEl.style.top),
                left: parseFloat(chatEl.style.left)
            };
        }

        handle.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
        document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
        document.addEventListener('mouseup', endDrag);

        handle.addEventListener('touchstart', e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }, { passive: true });
        document.addEventListener('touchmove', e => { if (!dragging) return; const t = e.touches[0]; moveDrag(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    // ── Alt kenardan boy uzatma (resize) ──
    const resizeHandle = document.getElementById('gf-bc-resize-handle');
    if (resizeHandle && chatEl) {
        const MIN_H = 180, MAX_H = window.innerHeight * 0.75;
        let resizing = false, startY = 0, startH = 0;

        function startResize(clientY) {
            resizing = true;
            startY = clientY;
            startH = chatEl.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        }
        function doResize(clientY) {
            if (!resizing) return;
            const delta = clientY - startY;
            const newH = Math.min(MAX_H, Math.max(MIN_H, startH + delta));
            chatEl.style.maxHeight = newH + 'px';
            chatEl.style.height = newH + 'px';
        }
        function endResize() {
            if (!resizing) return;
            resizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        resizeHandle.addEventListener('mousedown', e => { startResize(e.clientY); e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('mousemove', e => doResize(e.clientY));
        document.addEventListener('mouseup', endResize);

        resizeHandle.addEventListener('touchstart', e => { startResize(e.touches[0].clientY); e.stopPropagation(); }, { passive: true });
        document.addEventListener('touchmove', e => { if (!resizing) return; doResize(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
        document.addEventListener('touchend', endResize);
    }

    // ── Küçült / Geri Aç ──
    const minimizeBtn = document.getElementById('gf-bc-minimize-btn');
    if (minimizeBtn && chatEl) {
        minimizeBtn.addEventListener('click', e => {
            e.stopPropagation();
            // Mevcut konumu kaydet
            const rect = chatEl.getBoundingClientRect();
            gfBcSavedPos = { top: rect.top, left: rect.left };
            chatEl.classList.add('gf-bc-minimized');
            // Küçültülmüş halde sağ kenarda, kayıtlı dikey konumda
            chatEl.style.left = (window.innerWidth - 52) + 'px';
            chatEl.style.top  = rect.top + 'px';
            chatEl.style.right = 'auto';
            chatEl.style.transform = 'none';
        });
        chatEl.addEventListener('click', () => {
            if (!chatEl.classList.contains('gf-bc-minimized')) return;
            chatEl.classList.remove('gf-bc-minimized');
            gfAlignBreakChat();
        });
    }
}
window.gfEnsureBreakChatBindings = gfEnsureBreakChatBindings;
