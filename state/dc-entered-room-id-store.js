// Merkezi _dcEnteredRoomId deposu — Faz V. _dcEnteredRoomKey'in eşlik eden
// kısa-form kimliği (sadece alt-kanal id'si). Yazarlar: social.js,
// social-room-presence.js, social-server-tree.js.
export function getDcEnteredRoomId() {
    return window._dcEnteredRoomId || null;
}

export function setDcEnteredRoomId(id) {
    window._dcEnteredRoomId = id;
    return id;
}

window.getDcEnteredRoomId = getDcEnteredRoomId;
