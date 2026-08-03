export function getCurrentRoomPhase() {
    return window._currentRoomPhase || 'work';
}

export function setCurrentRoomPhase(v) {
    window._currentRoomPhase = v;
    return v;
}
