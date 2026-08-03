let _pvReadOnlyShowOwnTasks = false;

export function getPvReadOnlyShowOwnTasks() {
    return _pvReadOnlyShowOwnTasks;
}

export function setPvReadOnlyShowOwnTasks(v) {
    _pvReadOnlyShowOwnTasks = v;
    return v;
}

window.__getPvReadOnlyShowOwnTasks = getPvReadOnlyShowOwnTasks;
window.__setPvReadOnlyShowOwnTasks = setPvReadOnlyShowOwnTasks;
