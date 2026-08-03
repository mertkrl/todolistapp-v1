let _pvReadOnly = false;
let _pvReadOnlyTempId = null;

export function getPvReadOnly() {
    return _pvReadOnly;
}

export function setPvReadOnly(v) {
    _pvReadOnly = v;
    return v;
}

export function getPvReadOnlyTempId() {
    return _pvReadOnlyTempId;
}

export function setPvReadOnlyTempId(v) {
    _pvReadOnlyTempId = v;
    return v;
}

export function setPvReadOnlyPreview(val, tempId) {
    _pvReadOnly = val;
    _pvReadOnlyTempId = tempId;
}

window.__getPvReadOnly = getPvReadOnly;
window.__setPvReadOnly = setPvReadOnly;
window.__getPvReadOnlyTempId = getPvReadOnlyTempId;
window.__setPvReadOnlyTempId = setPvReadOnlyTempId;
window._pgSetPvReadOnlyPreview = setPvReadOnlyPreview;
