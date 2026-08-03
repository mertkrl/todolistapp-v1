let mindDumps = window.Store.mind_dumps.get();

export function getMindDumpsRef() {
    return mindDumps;
}

export function setMindDumpsRef(v) {
    mindDumps = v;
    return v;
}

window.__getMindDumpsRef = getMindDumpsRef;
window.__setMindDumpsRef = setMindDumpsRef;
