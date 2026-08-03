export function getSharedFocusBreakMinutes() {
    return window._sharedFocusBreakMinutes ?? 10;
}

export function setSharedFocusBreakMinutes(v) {
    window._sharedFocusBreakMinutes = v;
    return v;
}
