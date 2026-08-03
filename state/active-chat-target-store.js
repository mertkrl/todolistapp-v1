// Merkezi _activeChatTarget deposu — Faz V (currentUser store'unun devamı).
// Şu an açık olan sohbet hedefini (DM kullanıcısı ya da grup odası) tutar.
// Yazarlar: social.js (grup/DM odası açılırken, kapanırken), social-dm-notifications.js
// (başlangıç değeri). Okuyucular (11 dosya) window._activeChatTarget yerine
// getActiveChatTarget() kullanır — davranış birebir aynı, tek fark artık tek
// bir modülden geçiyor olması (currentUser'daki desenle aynı, bkz. current-user-store.js).
const listeners = new Set();

export function getActiveChatTarget() {
    return window._activeChatTarget || null;
}

export function setActiveChatTarget(target) {
    window._activeChatTarget = target;
    listeners.forEach(fn => fn(target));
    return target;
}

export function onActiveChatTargetChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

window.getActiveChatTarget = getActiveChatTarget;
