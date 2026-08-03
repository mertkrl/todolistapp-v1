export function getSharedFocusInFocusMode() {
    return !!window._sharedFocusInFocusMode;
}

export function setSharedFocusInFocusMode(v) {
    window._sharedFocusInFocusMode = v;
    return v;
}
