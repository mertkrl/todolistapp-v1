let _pvSelectedDate = null;

export function getPvSelectedDate() {
    return _pvSelectedDate;
}

export function setPvSelectedDate(v) {
    _pvSelectedDate = v;
    return v;
}

window.__getPvSelectedDate = getPvSelectedDate;
window.__setPvSelectedDate = setPvSelectedDate;
