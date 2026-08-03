export function getSharedFocusTotalRounds() {
    return window._sharedFocusTotalRounds ?? 4;
}

export function setSharedFocusTotalRounds(v) {
    window._sharedFocusTotalRounds = v;
    return v;
}
