// ─── SABİTLE / SESSİZE AL / SON MESAJLAŞMALARDAN KALDIR ────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19).
// "Son mesajlaşmalar" listesindeki bir sohbeti sabitleme, sessize alma veya
// listeden gizleme — hepsi localStorage tabanlı, sunucuya yazmıyor.
//
// Dış bağımlılıklar:
// - loadJsonList/saveJsonList → social.js'te kalıyor (Engelle özelliği gibi
//   başka yerlerde de kullanılıyor), window.* köprüsüyle çağrılıyor.
// - renderRecentConversations → zaten window.* köprülüydü.
// - _recentConvos → window._dcGetRecentConvo(key) (salt-okunur, tek anahtar
//   okuma; obje kendisi social.js'te kalıyor, 28 başka yerde kullanılıyor)
function isChatPinned(username) {
    return window.loadJsonList('focusai_pinned_chats').includes(username);
}
window.isChatPinned = isChatPinned;

function toggleChatPinned(username) {
    let list = window.loadJsonList('focusai_pinned_chats');
    if (list.includes(username)) list = list.filter(u => u !== username);
    else list.push(username);
    window.saveJsonList('focusai_pinned_chats', list);
    window.renderRecentConversations();
}
window.toggleChatPinned = toggleChatPinned;

function isChatMuted(username) {
    return window.loadJsonList('focusai_muted_chats').includes(username);
}
window.isChatMuted = isChatMuted;

function toggleChatMuted(username) {
    let list = window.loadJsonList('focusai_muted_chats');
    if (list.includes(username)) list = list.filter(u => u !== username);
    else list.push(username);
    window.saveJsonList('focusai_muted_chats', list);
    window.renderRecentConversations();
}
window.toggleChatMuted = toggleChatMuted;

// ─── SON MESAJLAŞMALARDAN KALDIR ─────────────────────────
// Mesajları silmez; sadece o anki son mesaja kadarını "görülmüş" sayıp
// listeden gizler. Karşı taraf yeni bir mesaj atarsa sohbet listeye geri döner.
function loadDismissedRecentConvos() {
    try { return JSON.parse(localStorage.getItem('focusai_dismissed_recent_convos') || '{}'); }
    catch { return {}; }
}
window.loadDismissedRecentConvos = loadDismissedRecentConvos;

function saveDismissedRecentConvos(map) {
    localStorage.setItem('focusai_dismissed_recent_convos', JSON.stringify(map));
}
window.saveDismissedRecentConvos = saveDismissedRecentConvos;

function removeRecentConvo(key) {
    const c = window._dcGetRecentConvo(key);
    if (!c) return;
    const map = loadDismissedRecentConvos();
    map[key] = c.lastTimestamp || Date.now();
    saveDismissedRecentConvos(map);
    window.renderRecentConversations();
}
window.removeRecentConvo = removeRecentConvo;
