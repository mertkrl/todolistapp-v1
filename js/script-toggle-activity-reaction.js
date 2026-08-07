export function toggleActivityReaction(btn) {
    const countSpan = btn.querySelector('.reaction-count');
    let currentCount = parseInt(countSpan.textContent) || 0;

    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        countSpan.textContent = currentCount - 1;
    } else {
        btn.classList.add('active');
        countSpan.textContent = currentCount + 1;
    }
}

window.toggleActivityReaction = toggleActivityReaction;
