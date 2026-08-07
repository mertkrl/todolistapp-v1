// script-premium-alert-toast.js
// script.js'ten çıkarıldı: birbirinden bağımsız, closure-siz iki küçük parça:
// - window.alert override: amatör tarayıcı uyarılarını premium toast bildirime çevirir.
// - Kitaplık özet kutusu (book-spine) hover tooltip'inin sağ kenardan taşmasını
//   önleyen konum motoru.

// ================================================================
// [PREMIUM VALIDATION] AMATÖR UYARILARI AKILLI TOAST BİLDİRİME DÖNÜŞTÜRÜCÜ
// ================================================================
window.alert = function(message) {
    // 1. Ekranda zaten eski bir bildirim varsa anında temizle
    document.getElementById('premium-alert-toast')?.remove();

    // 2. Yeni premium bildirim kartı oluştur
    const toast = document.createElement('div');
    toast.id = 'premium-alert-toast';

    // Tasarım ve pürüzsüzlük kodları (FocusAI Premium Karanlık Tema Uyumu)
    Object.assign(toast.style, {
        position: 'fixed',
        top: '25px',
        right: '25px',
        backgroundColor: 'rgba(26, 26, 36, 0.96)',
        color: '#ffffff',
        padding: '16px 26px',
        borderRadius: '14px',
        boxShadow: '0 15px 35px rgba(255, 71, 87, 0.25), 0 0 1px 1px rgba(255, 71, 87, 0.4)',
        zIndex: '999999',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        backdropFilter: 'blur(12px)',
        borderLeft: '5px solid #ff4757',
        transform: 'translateX(130%)',
        transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });

    // İçerik mimarisi (İkon + Mesaj)
    toast.innerHTML = `<i class="fa-solid fa-circle-exclamation u-color-hff4757_font-size-18px" ></i> <span>${escapeHtml(message)}</span>`;

    // Kartı ekrana iğnele
    document.body.appendChild(toast);

    // 3. Ekranda o an açık olan ve boş bırakılan tüm alanları bulup titret (CSS ile birleşme noktası)
    document.querySelectorAll('input, textarea').forEach(el => {
        if ((el.value.trim() === "" || el.classList.contains('invalid')) && el.offsetParent !== null) {
            el.classList.add('premium-input-error');
            // Animasyon bittiğinde sınıfı temizle ki bir sonraki hatada tekrar titreyebilsin
            setTimeout(() => el.classList.remove('premium-input-error'), 450);
        }
    });

    // 4. Milisaniyeler içinde sağdan pürüzsüzce kaydırarak ekrana getir
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 40);

    // 5. 4 saniye sonra pürüzsüzce sağa doğru kaydırarak yok et
    setTimeout(() => {
        toast.style.transform = 'translateX(130%)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// Kitaplık özet kutusunun sağ kenardan taşmasını önleyen güncellenmiş konum motoru
document.addEventListener('mouseover', (e) => {
    const book = e.target.closest('.book-spine'); // Sınıf adını kütüphane element yapınıza göre eşitledik
    if (!book) return;

    const tooltip = book.querySelector('.book-premium-tooltip');
    if (!tooltip) return;

    // Önce sınıfı temizle
    tooltip.classList.remove('edge-right');

    const bookRect = book.getBoundingClientRect();
    const tooltipWidth = 280; // Özet kutusunun ortalama genişliği
    const distanceToRight = window.innerWidth - bookRect.right;

    // Eğer sağ kenarda kutunun sığacağı kadar (genişlik + güvenli pay) yer kalmadıysa sola aç
    if (distanceToRight < (tooltipWidth + 30)) {
        tooltip.classList.add('edge-right');
    }
});
