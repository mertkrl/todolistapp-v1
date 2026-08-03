let _pvDayCursor = null;

export function getPvDayCursor() {
    return _pvDayCursor;
}

export function setPvDayCursor(v) {
    _pvDayCursor = v;
    return v;
}

window.__getPvDayCursor = getPvDayCursor;
window.__setPvDayCursor = setPvDayCursor;
