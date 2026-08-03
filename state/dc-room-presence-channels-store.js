let _dcRoomPresenceChannels = {};

export function getDcRoomPresenceChannels() {
    return _dcRoomPresenceChannels;
}

export function setDcRoomPresenceChannels(v) {
    _dcRoomPresenceChannels = v;
    return v;
}

window.__getDcRoomPresenceChannels = getDcRoomPresenceChannels;
window.__setDcRoomPresenceChannels = setDcRoomPresenceChannels;
