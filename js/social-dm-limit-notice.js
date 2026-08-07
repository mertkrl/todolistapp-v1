// social-dm-limit-notice.js
// social.js'ten çıkarıldı (Faz 5, arkadaşlık/bildirim kümesinin en izole
// parçası): arkadaş olmayan kişiye 1 mesaj sınırı uyarısı.
// Tek dış bağımlılık: social.js:16496'daki bare çağrı window.showDcDmLimitNotice()'e çevrildi.

let _dcDmLimitWarningShown = false;
export function showDcDmLimitNotice() {
    if (_dcDmLimitWarningShown) return;
    _dcDmLimitWarningShown = true;
    const streamEl = document.getElementById('sidebar-chat-messages-stream');
    if (streamEl) {
        const warn = document.createElement('div');
        warn.className = 'dc-rate-limit-warning';
        warn.style.textAlign = 'center';
        warn.style.color = '#ff7675';
        warn.style.fontSize = '12px';
        warn.style.padding = '6px';
        warn.style.opacity = '0.9';
        warn.textContent = 'Bu kişi seni arkadaş olarak eklemeden veya sohbete devam etmeden başka mesaj gönderemezsin.';
        streamEl.appendChild(warn);
        streamEl.scrollTop = streamEl.scrollHeight;
        setTimeout(() => warn.remove(), 4000);
    }
    setTimeout(() => { _dcDmLimitWarningShown = false; }, 4000);
}
window.showDcDmLimitNotice = showDcDmLimitNotice;
