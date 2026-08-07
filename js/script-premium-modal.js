export function showPremiumModal({ title, message, type = 'info', showCancel = false, confirmText = 'Tamam', cancelText = 'İptal', onConfirm = null }) {
    const premiumModal = document.getElementById('premium-modal');
    const pmIconWrapper = document.getElementById('premium-modal-icon-wrapper');
    const pmIcon = document.getElementById('premium-modal-icon');
    const pmTitle = document.getElementById('premium-modal-title');
    const pmMessage = document.getElementById('premium-modal-message');
    let pmCancelBtn = document.getElementById('premium-modal-cancel-btn');
    let pmConfirmBtn = document.getElementById('premium-modal-confirm-btn');

    pmTitle.textContent = title;
    pmMessage.innerHTML = window.escapeHtml(message);

    pmIconWrapper.className = `modal-icon-wrapper ${type}`;
    if (type === 'success') pmIcon.className = 'fa-solid fa-check';
    else if (type === 'warning') pmIcon.className = 'fa-solid fa-triangle-exclamation';
    else pmIcon.className = 'fa-solid fa-circle-info';

    const newConfirmBtn = pmConfirmBtn.cloneNode(true);
    pmConfirmBtn.parentNode.replaceChild(newConfirmBtn, pmConfirmBtn);
    pmConfirmBtn = newConfirmBtn;
    pmConfirmBtn.textContent = confirmText;

    const newCancelBtn = pmCancelBtn.cloneNode(true);
    pmCancelBtn.parentNode.replaceChild(newCancelBtn, pmCancelBtn);
    pmCancelBtn = newCancelBtn;
    pmCancelBtn.textContent = cancelText;

    if (showCancel) pmCancelBtn.classList.remove('hidden');
    else pmCancelBtn.classList.add('hidden');

    premiumModal.style.zIndex = '999999';
    premiumModal.classList.remove('hidden');

    pmConfirmBtn.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });

    pmCancelBtn.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
    });
}
