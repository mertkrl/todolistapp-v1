export function getSharedFocusBindingsReady() {
    return !!window._sharedFocusBindingsReady;
}

export function setSharedFocusBindingsReady(v) {
    window._sharedFocusBindingsReady = v;
    return v;
}
