let _currentActiveGroupCode = null;

export function getCurrentActiveGroupCode() {
    return _currentActiveGroupCode;
}

export function setCurrentActiveGroupCode(v) {
    _currentActiveGroupCode = v;
    return v;
}

window.__getCurrentActiveGroupCodeRef = getCurrentActiveGroupCode;
window.__setCurrentActiveGroupCodeRef = setCurrentActiveGroupCode;
