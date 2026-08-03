// Merkezi _pendingClassroomSubtab deposu — Faz V. Kurum panelinde sınıf
// sekmesi açılırken hangi alt-sekmenin seçili olacağını taşır. Yazarlar:
// social.js, social-institution-panel.js.
export function getPendingClassroomSubtab() {
    return window._pendingClassroomSubtab || null;
}

export function setPendingClassroomSubtab(v) {
    window._pendingClassroomSubtab = v;
    return v;
}

window.getPendingClassroomSubtab = getPendingClassroomSubtab;
