let _detailGoalId = null;

export function getPgDetailGoalId() {
    return _detailGoalId;
}

export function setPgDetailGoalId(v) {
    _detailGoalId = v;
    return v;
}

window._pgGetDetailGoalId = getPgDetailGoalId;
window._pgSetDetailGoalId = setPgDetailGoalId;
