export function getCwTimerInterval() {
    return window._cwTimerInterval || null;
}

export function setCwTimerInterval(v) {
    window._cwTimerInterval = v;
    return v;
}
