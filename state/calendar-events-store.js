let calendarEvents = null;

export function getCalendarEventsRef() {
    return calendarEvents;
}

export function setCalendarEventsRef(v) {
    calendarEvents = v;
    return v;
}

window.__getCalendarEventsRef = getCalendarEventsRef;
window.__setCalendarEventsRef = setCalendarEventsRef;
