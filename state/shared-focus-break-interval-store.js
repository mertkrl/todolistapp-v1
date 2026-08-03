export function getSharedFocusBreakInterval() {
    return window._sharedFocusBreakInterval || null;
}

export function setSharedFocusBreakInterval(v) {
    window._sharedFocusBreakInterval = v;
    return v;
}
