// Merkezi _dcEnteredRoomKey deposu — Faz V (currentUser/active-chat-target/dc-state
// store'larının devamı). Şu an "girilmiş" (fiilen içinde bulunulan) çalışma odasının
// anahtarını tutar. Yazarlar: social.js, social-room-presence.js, social-server-tree.js.
export function getDcEnteredRoomKey() {
    return window._dcEnteredRoomKey || null;
}

export function setDcEnteredRoomKey(key) {
    window._dcEnteredRoomKey = key;
    return key;
}

window.getDcEnteredRoomKey = getDcEnteredRoomKey;
