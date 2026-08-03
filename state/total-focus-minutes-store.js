let _totalFocusMinutes = window.FocusStorage.get('focus_minutes', 0) || 0;

export function getTotalFocusMinutes() {
    return _totalFocusMinutes;
}

export function setTotalFocusMinutes(v) {
    _totalFocusMinutes = v;
    return v;
}

window.__getTotalFocusMinutesRef = getTotalFocusMinutes;
