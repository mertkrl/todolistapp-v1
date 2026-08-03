export function getSharedFocusSoloMode() {
    return !!window._sharedFocusSoloMode;
}

export function setSharedFocusSoloMode(v) {
    window._sharedFocusSoloMode = v;
    return v;
}
