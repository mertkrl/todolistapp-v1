let _pvCalYear = new Date().getFullYear();

export function getPvCalYear() {
    return _pvCalYear;
}

export function setPvCalYear(v) {
    _pvCalYear = v;
    return v;
}

window.__getPvCalYear = getPvCalYear;
window.__setPvCalYear = setPvCalYear;
