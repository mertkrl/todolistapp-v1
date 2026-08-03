export function getScwTimeLeft() {
    return window._scwTimeLeft !== undefined ? window._scwTimeLeft : 25 * 60;
}

export function setScwTimeLeft(v) {
    window._scwTimeLeft = v;
    return v;
}

export function getScwTimerInterval() {
    return window._scwTimerInterval || null;
}

export function setScwTimerInterval(v) {
    window._scwTimerInterval = v;
    return v;
}

export function getIsScwRunning() {
    return !!window._isScwRunning;
}

export function setIsScwRunning(v) {
    window._isScwRunning = v;
    return v;
}
