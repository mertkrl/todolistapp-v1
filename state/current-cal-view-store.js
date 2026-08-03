let _currentCalView = 'monthly';

export function getCurrentCalView() {
    return _currentCalView;
}

export function setCurrentCalView(v) {
    _currentCalView = v;
    return v;
}

window.__getCurrentCalView = getCurrentCalView;
window.__setCurrentCalView = setCurrentCalView;
