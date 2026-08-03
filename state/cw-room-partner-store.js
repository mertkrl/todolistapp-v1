export function getCwPartnerUsername() {
    return window._cwPartnerUsername || null;
}

export function getCwPartnerName() {
    return window._cwPartnerName || null;
}

export function getCwPartnerColor() {
    return window._cwPartnerColor || null;
}

export function setCwPartnerInfo(username, name, color) {
    window._cwPartnerUsername = username;
    window._cwPartnerName = name;
    window._cwPartnerColor = color;
}
