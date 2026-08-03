// ─── DC SOHBET MESAJI — KÜÇÜK DOM YARDIMCILARI ─────────────────────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu): mesaj balonu
// oluştururken kullanılan küçük, bağımsız DOM yardımcıları. Hiçbiri
// social.js'in paylaşılan durumuna (currentUser hariç — o zaten global)
// dokunmuyor, sadece kendilerine verilen DOM elementini/parametreyi işliyor.
import { subscribeDcOnlineStatus } from './social-dc-online-status.js';

function _dcAutoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// Gönderilemeyen (optimistic) mesaj baloncuğunu "tekrar dene" durumuna geçirir.
function _dcMarkPendingBubbleFailed(pending, onRetry) {
    if (!pending || !pending.statusEl) return;
    pending.statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation u-font-size-9px" ></i> Gönderilemedi — tekrar dene';
    pending.statusEl.style.color = '#ff7675';
    pending.statusEl.style.cursor = 'pointer';
    pending.statusEl.onclick = () => {
        pending.statusEl.style.color = 'rgba(255,255,255,0.4)';
        pending.statusEl.style.cursor = 'default';
        pending.statusEl.innerHTML = '<i class="fa-solid fa-clock u-font-size-9px" ></i> Gönderiliyor…';
        onRetry();
    };
}

function _dcRemovePendingBubble(pending) {
    if (pending && pending.row) pending.row.remove();
}

// Mesaj satırına avatar + çevrimiçi durum noktası ekler, tıklayınca mini
// profil açar.
function attachDcMsgAvatar(row, m) {
    const { url: avUrl, color: avColor } = window.resolveAvatar(m);
    const avWrap = document.createElement('div');
    avWrap.className = 'dc-msg-avatar-wrap';
    avWrap.style.position = 'relative';
    avWrap.style.flexShrink = '0';
    avWrap.style.marginTop = '2px';
    avWrap.style.width = '32px';
    avWrap.style.height = '32px';
    avWrap.style.cursor = 'pointer';
    avWrap.title = 'Profili Gör';
    const avatar = document.createElement('img');
    avatar.src = avUrl;
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.borderRadius = '50%';
    avatar.style.objectFit = 'cover';
    avatar.style.border = `2px solid #${avColor}`;
    avatar.style.boxSizing = 'border-box';
    avWrap.appendChild(avatar);
    const statusDot = document.createElement('span');
    statusDot.className = 'dc-dm-status-dot dc-msg-status-dot offline';
    statusDot.dataset.onlineUser = m.username;
    avWrap.appendChild(statusDot);
    avWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        window.openMiniProfile(m.username, { displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, avWrap);
    });
    row.appendChild(avWrap);
    subscribeDcOnlineStatus(m.username);
}

// Ardışık mesajlarda avatar yerine boşluk bırakır (hover'da saat gösterir).
function attachDcMsgSpacer(row, timeStr) {
    const spacer = document.createElement('div');
    spacer.className = 'dc-msg-spacer';
    spacer.style.width = '32px';
    spacer.style.flexShrink = '0';
    spacer.style.display = 'flex';
    spacer.style.alignItems = 'center';
    spacer.style.justifyContent = 'center';
    if (timeStr) {
        const hoverTime = document.createElement('span');
        hoverTime.className = 'dc-msg-compact-time';
        hoverTime.textContent = timeStr;
        spacer.appendChild(hoverTime);
    }
    row.appendChild(spacer);
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export {
    _dcAutoResizeTextarea, _dcMarkPendingBubbleFailed, _dcRemovePendingBubble,
    attachDcMsgAvatar, attachDcMsgSpacer
};
