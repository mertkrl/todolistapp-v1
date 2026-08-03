// Merkezi _activeReactionPicker deposu — Faz V. Açık emoji-tepki seçicisinin
// referansı ({ picker, outsideHandler }). Yazarlar: social.js, social-activity-feed.js.
export function getActiveReactionPicker() {
    return window._activeReactionPicker || null;
}

export function setActiveReactionPicker(v) {
    window._activeReactionPicker = v;
    return v;
}

window.getActiveReactionPicker = getActiveReactionPicker;
