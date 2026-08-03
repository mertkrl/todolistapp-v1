let _pgRenderCount = 0;

export function getPgRenderCount() {
    return _pgRenderCount;
}

export function incPgRenderCount() {
    _pgRenderCount++;
    return _pgRenderCount;
}

window.__getPgRenderCountRef = getPgRenderCount;
window.__incPgRenderCountRef = incPgRenderCount;
