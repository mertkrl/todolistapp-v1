// auth-ui.js dosyasından çıkarıldı — yalnızca kendi parametrelerine (veya
// dışa açılan AVATAR_COLORS sabitine) bağlı, IIFE'nin paylaşılan
// mutable state'ine (_authMode/_selectedAvatarColor vb.) dokunmayan saf
// yardımcılar.
export const AVATAR_COLORS = [
    { color: '#6c63ff', label: 'Mor' },
    { color: '#2ed573', label: 'Yeşil' },
    { color: '#ff6b81', label: 'Pembe' },
    { color: '#ffa502', label: 'Turuncu' },
    { color: '#1e90ff', label: 'Mavi' },
    { color: '#ff4757', label: 'Kırmızı' },
    { color: '#eccc68', label: 'Sarı' },
    { color: '#a29bfe', label: 'Lavanta' },
];

export function _toast(msg, type = 'success') {
    const colors = { success: '#2ed573', error: '#ff4757', warning: '#ff9f43' };
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '30px', right: '30px', zIndex: '999999',
        background: colors[type] || colors.success,
        color: '#000', padding: '12px 20px', borderRadius: '12px',
        fontSize: '13px', fontFamily: 'Poppins,sans-serif', fontWeight: '600',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        opacity: '0', transform: 'translateY(10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function _avatarColorSwatches() {
    return AVATAR_COLORS.map((a, i) =>
        `<button type="button" class="avatar-swatch u-width-32px_height-32px_border-radius-50pct_cursor-pointer_" data-color="${a.color}" title="${a.label}"

 ${i === 0 ? 'data-selected="true"' : ''}></button>`
    ).join('');
}

// Yeni şifre belirleme akışları (kayıt/sıfırlama) için — mevcut
// kullanıcıların girişini etkilemez, sadece yeni şifre oluştururken
// uygulanır (mevcut hesaplar 6 karakterle oluşturulmuş olabilir, login
// akışında bu kontrolü uygulamak onları hesaplarından kilitlerdi).
export function _isStrongPassword(password) {
    return typeof password === 'string' && password.length >= 8 && /\d/.test(password);
}

export function _validateEmail(email, statusEl) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        statusEl.textContent = 'Lütfen geçerli bir e-posta adresi gir.';
        statusEl.style.color = '#ff4757';
        return false;
    }
    return true;
}

export function _summaryRow(icon, label, count) {
    return `<li class="u-display-flex_align-items-center_gap-10px"><i class="fa-solid ${icon} u-width-18px_text-align-center_color-var-primary-color" ></i> ${count} ${label}</li>`;
}
