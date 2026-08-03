let _myGroupsDataCache = {};

export function getMyGroupsDataCache() {
    return _myGroupsDataCache;
}

export function setMyGroupsDataCache(v) {
    _myGroupsDataCache = v;
    return v;
}

window.getMyGroupsDataCache = getMyGroupsDataCache;
window.__setMyGroupsDataCacheRef = setMyGroupsDataCache;
