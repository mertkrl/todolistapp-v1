// Merkezi _hushedNotifQueue deposu — Faz V. Odaklanma "sessize alma" kalkanı
// açıkken bastırılan bildirim başlıklarının kuyruğu. Yazarlar: social-focus-hush.js
// (özetleyip sıfırlar), social-dm-notifications.js (kuyruğa ekler) — ikisi de
// önceden `window.X = window.X || []` guard deseniyle başlatıyordu, ensure()
// bunu tek yerde topluyor.
export function getHushedNotifQueue() {
    return window._hushedNotifQueue || null;
}

export function setHushedNotifQueue(queue) {
    window._hushedNotifQueue = queue;
    return queue;
}

export function ensureHushedNotifQueue() {
    if (!window._hushedNotifQueue) window._hushedNotifQueue = [];
    return window._hushedNotifQueue;
}

window.getHushedNotifQueue = getHushedNotifQueue;
