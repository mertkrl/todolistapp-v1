// One-time migration: move any YYYY-MM-DD keyed events to DD-MM-YYYY keys.
// Mutates calendarEvents in place; caller persists via Store.events.set if changed.
export function migrateEventKeys(calendarEvents) {
    let changed = false;
    const toFix = Object.keys(calendarEvents).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    toFix.forEach(oldKey => {
        const p = oldKey.split('-');
        const newKey = `${p[2]}-${p[1]}-${p[0]}`;
        if (!calendarEvents[newKey]) calendarEvents[newKey] = [];
        calendarEvents[newKey] = [...calendarEvents[newKey], ...calendarEvents[oldKey]];
        delete calendarEvents[oldKey];
        changed = true;
    });
    return changed;
}
