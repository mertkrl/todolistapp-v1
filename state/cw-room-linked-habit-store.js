export function getCwRoomLinkedHabit() {
    return window._cwRoomLinkedHabit || null;
}

export function setCwRoomLinkedHabit(v) {
    window._cwRoomLinkedHabit = v;
    return v;
}
