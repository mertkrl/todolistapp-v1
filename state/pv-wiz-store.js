let _pvWiz = null; // { step:'welcome'|'count'|'names'|'dates'|'done', count:0, names:[], dateIdx:0 }

export function getPvWiz() {
    return _pvWiz;
}

export function setPvWiz(v) {
    _pvWiz = v;
    return v;
}

window.__getPvWiz = getPvWiz;
window.__setPvWiz = setPvWiz;
