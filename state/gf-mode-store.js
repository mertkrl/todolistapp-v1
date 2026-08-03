export function getGfMode() {
    return window._gfMode || null;
}

export function setGfMode(v) {
    window._gfMode = v;
    return v;
}
