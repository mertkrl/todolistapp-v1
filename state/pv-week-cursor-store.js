let _pvWeekCursor = null;

export function getPvWeekCursor() {
    return _pvWeekCursor;
}

export function setPvWeekCursor(v) {
    _pvWeekCursor = v;
    return v;
}

window.__getPvWeekCursor = getPvWeekCursor;
window.__setPvWeekCursor = setPvWeekCursor;
