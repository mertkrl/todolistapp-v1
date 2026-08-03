let _dcCurrentRoomPresence = [];

export function getDcCurrentRoomPresence() {
    return _dcCurrentRoomPresence;
}

export function setDcCurrentRoomPresence(v) {
    _dcCurrentRoomPresence = v;
    return v;
}

window.__getDcCurrentRoomPresence = getDcCurrentRoomPresence;
window.__setDcCurrentRoomPresence = setDcCurrentRoomPresence;
