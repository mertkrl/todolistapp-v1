let _pvUnsaved = false;

export function getPvUnsaved() {
    return _pvUnsaved;
}

export function setPvUnsaved(v) {
    _pvUnsaved = v;
    return v;
}

window.__getPvUnsaved = getPvUnsaved;
window.__setPvUnsaved = setPvUnsaved;
