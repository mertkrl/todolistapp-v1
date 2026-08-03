let _dcOtherLastRead = 0;

export function getDcOtherLastRead() {
    return _dcOtherLastRead;
}

export function setDcOtherLastRead(v) {
    _dcOtherLastRead = v;
    return v;
}

window.__getDcOtherLastRead = getDcOtherLastRead;
window.__setDcOtherLastRead = setDcOtherLastRead;
