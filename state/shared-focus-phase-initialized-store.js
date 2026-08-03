export function getSharedFocusPhaseInitialized() {
    return !!window._sharedFocusPhaseInitialized;
}

export function setSharedFocusPhaseInitialized(v) {
    window._sharedFocusPhaseInitialized = v;
    return v;
}
