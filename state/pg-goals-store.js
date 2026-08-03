let _goals = [];

export function getPgGoalsArr() {
    return _goals;
}

export function setPgGoalsArr(v) {
    _goals = v;
    return v;
}

window._pgGetGoals = getPgGoalsArr;
window._pgSetGoals = setPgGoalsArr;
