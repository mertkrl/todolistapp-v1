import { loadJsonList, saveJsonList, renderRecentConversations, _dcGetRecentConvo } from './social-dm-notifications.js';
// ─── SABİTLE / SESSİZE AL / SON MESAJLAŞMALARDAN KALDIR ────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19).
// "Son mesajlaşmalar" listesindeki bir sohbeti sabitleme, sessize alma veya
// listeden gizleme — hepsi localStorage tabanlı, sunucuya yazmıyor.
//
// Dış bağımlılıklar:
// - loadJsonList/saveJsonList → social.js'te kalıyor (Engelle özelliği gibi
//   başka yerlerde de kullanılıyor), window.* köprüsüyle çağrılıyor.
// - renderRecentConversations → zaten window.* köprülüydü.
// - _recentConvos → _dcGetRecentConvo(key) (salt-okunur, tek anahtar
//   okuma; obje kendisi social.js'te kalıyor, 28 başka yerde kullanılıyor)
export function isChatPinned(username) {
    return loadJsonList('focusai_pinned_chats').includes(username);
}
window.isChatPinned = isChatPinned;

export function toggleChatPinned(username) {
    let list = loadJsonList('focusai_pinned_chats');
    if (list.includes(username)) list = list.filter(u => u !== username);
    else list.push(username);
    saveJsonList('focusai_pinned_chats', list);
    renderRecentConversations();
}
window.toggleChatPinned = toggleChatPinned;

export function isChatMuted(username) {
    return loadJsonList('focusai_muted_chats').includes(username);
}
window.isChatMuted = isChatMuted;

export function toggleChatMuted(username) {
    let list = loadJsonList('focusai_muted_chats');
    if (list.includes(username)) list = list.filter(u => u !== username);
    else list.push(username);
    saveJsonList('focusai_muted_chats', list);
    renderRecentConversations();
}
window.toggleChatMuted = toggleChatMuted;

// ─── SON MESAJLAŞMALARDAN KALDIR ─────────────────────────
// Mesajları silmez; sadece o anki son mesaja kadarını "görülmüş" sayıp
// listeden gizler. Karşı taraf yeni bir mesaj atarsa sohbet listeye geri döner.
export function loadDismissedRecentConvos() {
    try { return JSON.parse(localStorage.getItem('focusai_dismissed_recent_convos') || '{}', window._safeJsonReviver); }
    catch { return {}; }
}
window.loadDismissedRecentConvos = loadDismissedRecentConvos;

export function saveDismissedRecentConvos(map) {
    localStorage.setItem('focusai_dismissed_recent_convos', JSON.stringify(map));
}
window.saveDismissedRecentConvos = saveDismissedRecentConvos;

export function removeRecentConvo(key) {
    const c = _dcGetRecentConvo(key);
    if (!c) return;
    const map = loadDismissedRecentConvos();
    map[key] = c.lastTimestamp || Date.now();
    saveDismissedRecentConvos(map);
    renderRecentConversations();
}
window.removeRecentConvo = removeRecentConvo;
