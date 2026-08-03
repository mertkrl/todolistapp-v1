export function getCwRoomOriginGroupScope() {
    return window._cwRoomOriginGroupScope || null;
}

export function setCwRoomOriginGroupScope(v) {
    window._cwRoomOriginGroupScope = v;
    return v;
}
