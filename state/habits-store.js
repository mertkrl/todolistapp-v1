let habits = null;

export function getHabitsRef() {
    return habits;
}

export function setHabitsRef(v) {
    habits = v;
    return v;
}

window.__getHabitsRef = getHabitsRef;
window.__setHabitsRef = setHabitsRef;
