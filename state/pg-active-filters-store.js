let _activeFilters = new Set(['all']);

export function getPgActiveFilters() {
    return _activeFilters;
}

export function setPgActiveFilters(v) {
    _activeFilters = v;
    return v;
}

window._pgGetActiveFilters = getPgActiveFilters;
window._pgSetActiveFilters = setPgActiveFilters;
