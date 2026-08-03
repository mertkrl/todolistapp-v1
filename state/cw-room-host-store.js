export function getCwRoomIsHost() {
    return !!window._cwRoomIsHost;
}

export function setCwRoomIsHost(v) {
    window._cwRoomIsHost = v;
    return v;
}
