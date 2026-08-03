export function getSharedFocusSession() {
    return window._sharedFocusSession || null;
}

export function setSharedFocusSession(v) {
    window._sharedFocusSession = v;
    return v;
}
