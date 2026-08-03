export function getSharedFocusMinimized() {
    return !!window._sharedFocusMinimized;
}

export function setSharedFocusMinimized(v) {
    window._sharedFocusMinimized = !!v;
    return window._sharedFocusMinimized;
}
