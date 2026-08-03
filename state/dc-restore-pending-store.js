// Merkezi _dcRestorePending deposu — Faz V. Sayfa açılışında önceki sohbet
// odasının geri yüklenmesi sürerken true olan kilit bayrağı (boolean, 0/false
// anlamlı olduğu için `|| null` normalize edilmiyor — ham değer döndürülüyor).
// Tek yazar: social.js.
export function getDcRestorePending() {
    return window._dcRestorePending;
}

export function setDcRestorePending(v) {
    window._dcRestorePending = v;
    return v;
}

window.getDcRestorePending = getDcRestorePending;
