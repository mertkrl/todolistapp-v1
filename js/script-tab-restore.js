// Kaydedilen son aktif sekmeyi tüm ilgili DOM durumuna (section, nav, dock, body attr)
// uygular. DOMContentLoaded içinde (flash önleme + nav/dock senkronu için) ve
// `pageshow` olayında (bfcache'den geri gelindiğinde JS yeniden çalışmadığı için
// sayfa eski/varsayılan sekmede donmuş görünebiliyordu) çağrılır.
export function applyLastActiveTab() {
    const target = FocusStorage.get('lastActiveTab', 'bugun');
    document.querySelectorAll('.page-section').forEach(function(s) {
        s.classList.toggle('active', s.id === target);
    });
    document.querySelectorAll('.nav-links li[data-target]').forEach(function(nav) {
        nav.classList.toggle('active', nav.getAttribute('data-target') === target);
    });
    document.querySelectorAll('#app-dock .di[data-target]').forEach(function(d) {
        d.classList.toggle('act', d.getAttribute('data-target') === target);
    });
    document.body.setAttribute('data-active-tab', target);
    // İlk boyama öncesi flash önleme için <head>'e enjekte edilen geçici CSS
    // kuralını (bkz. index.html "erken sekme restorasyonu") kaldır — kalıcı
    // kalırsa hedef section'ı sonsuza dek zorla görünür bırakıp (display
    // !important), kullanıcı başka bir sekmeye geçse bile o section ekranda
    // kalmaya devam ediyordu (bkz. kullanıcı geri bildirimi: "Alışkanlıklar"
    // sekmesinde takılı kalma sorunu).
    document.getElementById('early-tab-restore-style')?.remove();
    return target;
}
window.applyLastActiveTab = applyLastActiveTab;
