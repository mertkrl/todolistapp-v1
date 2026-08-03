export function getDcActiveGroupCode() {
    return window._dcActiveGroupCode || null;
}

export function setDcActiveGroupCode(v) {
    window._dcActiveGroupCode = v;
    return v;
}
