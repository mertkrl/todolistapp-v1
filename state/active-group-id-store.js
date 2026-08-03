let _activeGroupId = null;

export function getActiveGroupId() {
    return _activeGroupId;
}

export function setActiveGroupId(v) {
    _activeGroupId = v;
    return v;
}

window.__getActiveGroupIdRef = getActiveGroupId;
