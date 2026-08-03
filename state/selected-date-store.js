let selectedDate = new Date();

export function getSelectedDateRef() {
    return selectedDate;
}

export function setSelectedDateRef(v) {
    selectedDate = v;
    return v;
}

window.__getSelectedDateRef = getSelectedDateRef;
window.__setSelectedDateRef = setSelectedDateRef;
