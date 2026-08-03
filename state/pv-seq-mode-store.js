let _pvSeqMode = false;

export function getPvSeqMode() {
    return _pvSeqMode;
}

export function setPvSeqMode(v) {
    _pvSeqMode = v;
    return v;
}

window.__getPvSeqMode = getPvSeqMode;
window.__setPvSeqMode = setPvSeqMode;
