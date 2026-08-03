let currentDate = new Date();

export function getCurrentDateRef() {
    return currentDate;
}

export function setCurrentDateRef(v) {
    currentDate = v;
    return v;
}

window.__getCurrentDateRef = getCurrentDateRef;
window.__setCurrentDateRef = setCurrentDateRef;
