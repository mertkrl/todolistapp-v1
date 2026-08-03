let _pvCalView = 'month';

export function getPvCalView() {
    return _pvCalView;
}

export function setPvCalView(v) {
    _pvCalView = v;
    return v;
}

window.__getPvCalView = getPvCalView;
window.__setPvCalView = setPvCalView;
