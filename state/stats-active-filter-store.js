let _statsActiveFilter = 7;

export function getStatsActiveFilter() {
    return _statsActiveFilter;
}

export function setStatsActiveFilter(v) {
    _statsActiveFilter = v;
    return v;
}

window.__getStatsActiveFilter = getStatsActiveFilter;
