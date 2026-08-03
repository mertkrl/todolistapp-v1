let _dependencies = [];

export function getPgDependencies() {
    return _dependencies;
}

export function setPgDependencies(v) {
    _dependencies = v;
    return v;
}

window._pgGetDependencies = getPgDependencies;
window._pgSetDependencies = setPgDependencies;
