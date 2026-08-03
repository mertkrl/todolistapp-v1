let tasks = null;

export function getTasksRef() {
    return tasks;
}

export function setTasksRef(v) {
    tasks = v;
    return v;
}

window.__getTasksRef = getTasksRef;
window.__setTasksRef = setTasksRef;
