// script-onboarding-tour.js'ten çıkarıldı: tur adım verisi (saf sabit).

// tourFlows: tek bir genel 'main' turu — uygulamadaki tüm ana bölümleri sırayla
// tanıtır. Sadece bilgilendirme amaçlıdır: hiçbir adım kullanıcıdan gerçek bir
// butona tıklamasını/form doldurmasını istemez, "İleri" ile serbestçe ilerlenir.
export const tourFlows = {
main: [
    {
        tab: 'bugun', target: '#bugun .section-header', plain: true,
        badge: 'Bugün', icon: '🎯',
        title: 'Bugünün Görevleri',
        text: 'Ana ekranın burası — bugün yapman gerekenleri buradan görür, ekler ve takip edersin.'
    },
    {
        tab: 'hedefler', target: '#hedefler .section-header', plain: true,
        badge: 'Hedefler', icon: '🏔️',
        title: 'Ana Hedefler',
        text: 'Günlük görevler küçük adımlardır; <strong>Ana Hedefler</strong> ise onların bağlandığı büyük resimdir.'
    },
    {
        tab: 'zihin-coplugu', target: '#zihin-coplugu .section-header', plain: true,
        badge: 'Zihin Çöplüğü', icon: '🧠',
        title: 'Zihin Çöplüğü',
        text: 'Aklına takılan her şeyi buraya boşalt. İstersen sonra bir göreve ya da hedefe dönüştürürsün.'
    },
    {
        tab: 'aliskanliklar', target: '#aliskanliklar .section-header', plain: true,
        badge: 'Alışkanlıklar', icon: '🌱',
        title: 'Alışkanlıklar',
        text: 'Tek seferlik görevlerden farklı olarak alışkanlıklar tekrarla güçlenir; serilerini burada takip edersin.'
    },
    {
        tab: 'zamanlayici', target: '.timer-container', plain: true,
        badge: 'Zamanlayıcı', icon: '⏱️',
        title: 'Odaklanma Zamanlayıcısı',
        text: 'Pomodoro tekniğiyle kesintisiz odaklanma seansların burada başlar.'
    },
    {
        tab: 'takvim', target: '#takvim .cal-header', plain: true,
        badge: 'Takvim', icon: '📅',
        title: 'Takvim',
        text: 'Görevlerini ve etkinliklerini gün, hafta ya da ay görünümünde buradan planlarsın.'
    },
    {
        tab: 'istatistikler', target: '#istatistikler .section-header', plain: true,
        badge: 'İstatistikler', icon: '📊',
        title: 'İlerlemeni İzle',
        text: 'Her tamamladığın görev, her odak seansı burada birikir. Zamanla ne kadar ilerlediğini burada görebilirsin.'
    },
    {
        tab: 'gunluk', target: '#gunluk .section-header', plain: true,
        badge: 'Günlük', icon: '📖',
        title: 'Günlük',
        text: 'Günün nasıl geçti? Düşüncelerini burada kaydedip zamanla geriye dönüp bakabilirsin.'
    },
    {
        tab: 'arkadaslar', target: '#dc-home-view', plain: true,
        badge: 'Arena', icon: '🏆',
        title: 'Pozitif Rekabete Hoş Geldin',
        text: 'Burası Arena — arkadaşlarınla haftalık ligde yarışabilir, meydan okuma başlatabilir ve sıralamanı takip edebilirsin.'
    },
    {
        tab: 'planlama', target: '#planlama .section-header', plain: true,
        badge: 'Planlama', icon: '🗺️',
        title: 'Uzun Vadeli Planlama',
        text: 'Büyük hedeflerini haftalara ve aylara yayarak buradan planlarsın.'
    },
]
};
