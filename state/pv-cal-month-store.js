let _pvCalMonth = new Date().getMonth();

export function getPvCalMonth() {
    return _pvCalMonth;
}

export function setPvCalMonth(v) {
    _pvCalMonth = v;
    return v;
}

window.__getPvCalMonth = getPvCalMonth;
window.__setPvCalMonth = setPvCalMonth;
