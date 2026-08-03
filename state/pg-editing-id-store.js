let _editingId = null;

export function getEditingId() {
    return _editingId;
}

export function setEditingId(v) {
    _editingId = v;
    return v;
}

window.__getEditingId = getEditingId;
window.__setEditingId = setEditingId;
