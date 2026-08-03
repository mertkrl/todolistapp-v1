let _cddTimePopoverEl = null;

export function getCddTimePopoverEl() {
    return _cddTimePopoverEl;
}

export function setCddTimePopoverEl(el) {
    _cddTimePopoverEl = el;
    return el;
}

window.__getCddTimePopoverEl = getCddTimePopoverEl;
window.__setCddTimePopoverEl = setCddTimePopoverEl;
