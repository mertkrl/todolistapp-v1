// Merkezi _dcCurrentGroupScope deposu — Faz V. Açık grup sohbetinin scope'unu
// ({ type, id, ... }) tutar. Tek yazar: social.js.
export function getDcCurrentGroupScope() {
    return window._dcCurrentGroupScope || null;
}

export function setDcCurrentGroupScope(scope) {
    window._dcCurrentGroupScope = scope;
    return scope;
}

window.getDcCurrentGroupScope = getDcCurrentGroupScope;
