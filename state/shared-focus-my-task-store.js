export function getSharedFocusMyTaskId() {
    return window._sharedFocusMyTaskId || null;
}

export function getSharedFocusMyTaskText() {
    return window._sharedFocusMyTaskText || '';
}

export function setSharedFocusMyTask(id, text) {
    window._sharedFocusMyTaskId = id;
    window._sharedFocusMyTaskText = text;
}
