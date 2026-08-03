export function getCwSettingsOpenToAll() {
    return !!window._cwSettingsOpenToAll;
}

export function setCwSettingsOpenToAll(v) {
    window._cwSettingsOpenToAll = v;
    return v;
}
