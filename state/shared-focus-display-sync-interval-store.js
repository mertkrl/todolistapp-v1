export function getSharedFocusDisplaySyncInterval() {
    return window._sharedFocusDisplaySyncInterval || null;
}

export function setSharedFocusDisplaySyncInterval(v) {
    window._sharedFocusDisplaySyncInterval = v;
    return v;
}
