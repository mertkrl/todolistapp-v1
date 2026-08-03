let _pvActiveMsId = null;

export function getPvActiveMsId() {
    return _pvActiveMsId;
}

export function setPvActiveMsId(v) {
    _pvActiveMsId = v;
    return v;
}

window.__getPvActiveMsId = getPvActiveMsId;
window.__setPvActiveMsId = setPvActiveMsId;
