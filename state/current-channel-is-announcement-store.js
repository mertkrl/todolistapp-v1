let _currentChannelIsAnnouncement = false;

export function getCurrentChannelIsAnnouncement() {
    return _currentChannelIsAnnouncement;
}

export function setCurrentChannelIsAnnouncement(v) {
    _currentChannelIsAnnouncement = v;
    return v;
}

window.__getCurrentChannelIsAnnouncement = getCurrentChannelIsAnnouncement;
window.__setCurrentChannelIsAnnouncement = setCurrentChannelIsAnnouncement;
