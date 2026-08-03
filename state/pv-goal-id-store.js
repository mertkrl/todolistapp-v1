let _pvGoalId = null;

export function getPvGoalId() {
    return _pvGoalId;
}

export function setPvGoalId(v) {
    _pvGoalId = v;
    return v;
}

window.__getPvGoalId = getPvGoalId;
window.__setPvGoalId = setPvGoalId;
