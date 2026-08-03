// ─── DC SOHBET — KAYDIRMA (SCROLL) YARDIMCILARI ─────────────────────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu): mesaj akışında
// belirli bir mesaja atlama ve "aşağıdayım mı" kontrolü. İkisi de sadece
// verilen DOM elementini okuyor, social.js'in paylaşılan durumuna dokunmuyor.
//
// window.jumpToDcMsg/window.dcIsNearBottom köprüleri KORUNDU —
// social-message-pins.js ve social-chat-extras.js hâlâ bunları çağırıyor.

function dcIsNearBottom(streamEl) {
    if (!streamEl) return true;
    return (streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight) < 100;
}
window.dcIsNearBottom = dcIsNearBottom;

function jumpToDcMsg(msgKey) {
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    if (!streamEl) return;
    const target = streamEl.querySelector(`[data-msg-key="${window.CSS && CSS.escape ? CSS.escape(msgKey) : msgKey}"]`);
    if (!target) {
        const note = document.createElement('div');
        note.className = 'dc-rate-limit-warning';
        note.style.textAlign = 'center';
        note.style.color = 'rgba(255,255,255,0.5)';
        note.style.fontSize = '12px';
        note.style.padding = '6px';
        note.style.opacity = '0.9';
        note.textContent = 'Orijinal mesaj şu an yüklü değil.';
        streamEl.appendChild(note);
        streamEl.scrollTop = streamEl.scrollHeight;
        setTimeout(() => note.remove(), 2500);
        return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('dc-msg-jump-highlight');
    setTimeout(() => target.classList.remove('dc-msg-jump-highlight'), 1600);
}
window.jumpToDcMsg = jumpToDcMsg;

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { dcIsNearBottom, jumpToDcMsg };
