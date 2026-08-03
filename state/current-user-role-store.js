let _currentUserRole = 'member';

export function getCurrentUserRole() {
    return _currentUserRole;
}

export function setCurrentUserRole(v) {
    _currentUserRole = v;
    return v;
}

window.__getCurrentUserRoleRef = getCurrentUserRole;
window.__setCurrentUserRoleRef = setCurrentUserRole;
