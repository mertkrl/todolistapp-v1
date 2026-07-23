// Faz F: script.js'ten ayrıldı — Akşam Yansıması / Zihin Kütüphanesi için
// mantıksal tarih ve zaman-penceresi yardımcıları.
// Bağımlılıklar: window.formatDateToString (storage-manager.js, script.js'ten önce yüklenir).

window.getLogicalReflectionDate = function getLogicalReflectionDate() {
    let d = new Date();
    if (d.getHours() < 3) {
        d.setDate(d.getDate() - 1);
    }
    return window.formatDateToString(d);
};

window.isReflectionTime = function isReflectionTime() {
    const h = new Date().getHours();
    return (h >= 20 || h < 3);
};
