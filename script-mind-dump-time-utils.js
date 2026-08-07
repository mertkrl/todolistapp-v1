// script-mind-dump.js dosyasından çıkarıldı — saf, parametreye bağlı yardımcı.
export function dumpRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dakika önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return '1 hafta önce';
    if (weeks < 5) return `${weeks} hafta önce`;
    const months = Math.floor(days / 30);
    return `${months} ay önce`;
}
