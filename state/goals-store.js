let goals = null;

export function getGoalsRef() {
    return goals;
}

export function setGoalsRef(v) {
    goals = v;
    return v;
}

window.__getGoalsRef = getGoalsRef;
window.__setGoalsRef = setGoalsRef;
