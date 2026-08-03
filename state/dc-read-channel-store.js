let _dcReadChannel = null;

export function getDcReadChannel() {
    return _dcReadChannel;
}

export function setDcReadChannel(v) {
    _dcReadChannel = v;
    return v;
}

window.__getDcReadChannel = getDcReadChannel;
window.__setDcReadChannel = setDcReadChannel;
