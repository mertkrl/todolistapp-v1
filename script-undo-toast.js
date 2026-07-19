// ── UNDO (GERİ AL) SİSTEMİ → script.js'ten taşındı ──
document.addEventListener('DOMContentLoaded', () => {

let _undoTimer = null;

function showUndoToast(message, undoFn) {
    const existing = document.getElementById('undo-toast');
    if (existing) { existing.remove(); clearTimeout(_undoTimer); }

    const toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.innerHTML = `
        <span class="undo-msg">${window.escapeHtml(message)}</span>
        <button class="undo-btn-action">↩ Geri Al</button>
        <div class="undo-bar"></div>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        const bar = toast.querySelector('.undo-bar');
        if (bar) { bar.style.transition = 'width 5s linear'; bar.style.width = '0%'; }
    });

    const dismiss = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    };

    _undoTimer = setTimeout(dismiss, 5000);

    toast.querySelector('.undo-btn-action').addEventListener('click', () => {
        clearTimeout(_undoTimer);
        undoFn();
        dismiss();
    });
}
window.showUndoToast = showUndoToast;

});
