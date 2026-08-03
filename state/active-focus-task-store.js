let activeFocusTask = null;

export function getActiveFocusTaskRef() {
    return activeFocusTask;
}

export function setActiveFocusTaskRef(v) {
    activeFocusTask = v;
    return v;
}

window.__getActiveFocusTaskRef = getActiveFocusTaskRef;
window.__setActiveFocusTaskRef = setActiveFocusTaskRef;
