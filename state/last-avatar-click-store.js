// Merkezi _lastAvatarClick deposu — Faz V. Çevrimiçi listesinde avatara art
// arda tıklama (çift-tık) algılamak için kullanılan { username, time } nesnesi.
// Tek kurulum sitesi: social-dm-notifications.js; sonrası hep property
// mutasyonu (nesne referansı hiç değişmiyor).
export function getLastAvatarClick() {
    return window._lastAvatarClick || null;
}

export function setLastAvatarClick(v) {
    window._lastAvatarClick = v;
    return v;
}

window.getLastAvatarClick = getLastAvatarClick;
