// planning-misc-widgets-templates.js
// planning-misc-widgets.js dosyasından çıkarıldı: kategori bazlı Milestone
// Şablonları + Alt Görev önerileri — saf sabit veri tabloları, hiçbir dış
// bağımlılığı yok.

export const MILESTONE_TEMPLATES = {
    egitim: [
        { title: 'A1 Başlangıç',      icon: '📖', weeks: 8 },
        { title: 'A2 Temel Seviye',   icon: '📚', weeks: 8 },
        { title: 'B1 Orta Seviye',    icon: '🎯', weeks: 12 },
        { title: 'B2 İleri Seviye',   icon: '🚀', weeks: 16 },
        { title: 'Kurs Tamamla',       icon: '🎓', weeks: 10 },
        { title: 'Sertifika Sınavı',  icon: '📜', weeks: 4 },
        { title: 'Proje Yap',          icon: '🛠️', weeks: 8 },
        { title: 'Mentor Bul',         icon: '🤝', weeks: 2 },
    ],
    saglik: [
        { title: 'Doktor Muayenesi',      icon: '🏥', weeks: 1 },
        { title: 'Beslenme Planı Hazırla', icon: '🥗', weeks: 2 },
        { title: 'İlk 5K Koş',            icon: '🏃', weeks: 8 },
        { title: '10K Hedefine Ulaş',      icon: '🏅', weeks: 16 },
        { title: 'Hedef Kiloya Ulaş',      icon: '⚖️', weeks: 20 },
        { title: 'Yoga Rutini Kur',        icon: '🧘', weeks: 4 },
        { title: 'Uyku Düzeni Oluştur',   icon: '😴', weeks: 3 },
        { title: 'Spor Alışkanlığı Edin',  icon: '💪', weeks: 12 },
    ],
    kariyer: [
        { title: 'CV Güncelle',        icon: '📄', weeks: 1 },
        { title: 'Profesyonel Ağ Kur', icon: '🤝', weeks: 8 },
        { title: 'Yeni Beceri Öğren',  icon: '💡', weeks: 12 },
        { title: 'Portföy Hazırla',    icon: '🗂️', weeks: 6 },
        { title: 'İş Başvuruları',     icon: '📮', weeks: 8 },
        { title: 'Mülakat Hazırlığı',  icon: '💼', weeks: 4 },
        { title: 'Terfi Hedefle',      icon: '📈', weeks: 24 },
        { title: 'Freelance Başla',    icon: '🖥️', weeks: 12 },
    ],
    finans: [
        { title: 'Bütçe Planı Yap',    icon: '📊', weeks: 1 },
        { title: 'Acil Fon Oluştur',   icon: '🏦', weeks: 24 },
        { title: 'Borç Öde',           icon: '💳', weeks: 16 },
        { title: 'İlk Yatırım Yap',    icon: '📈', weeks: 12 },
        { title: '%10 Tasarruf Hedefi', icon: '💰', weeks: 8 },
        { title: 'Ek Gelir Kaynağı',   icon: '💹', weeks: 20 },
    ],
    kisisel: [
        { title: 'Yeni Hobi Başlat',     icon: '🎨', weeks: 4 },
        { title: 'Meditasyon Alışkanlığı',icon: '🧘', weeks: 4 },
        { title: 'Seyahat Planla',       icon: '✈️', weeks: 12 },
        { title: '12 Kitap Oku',         icon: '📚', weeks: 52 },
        { title: 'Sosyal Çevre Genişlet',icon: '👥', weeks: 8 },
        { title: 'Dijital Detoks',       icon: '📵', weeks: 2 },
    ],
    diger: [
        { title: 'Araştırma Yap',  icon: '🔍', weeks: 2 },
        { title: 'Plan Oluştur',   icon: '📋', weeks: 1 },
        { title: 'Kaynak Topla',   icon: '📦', weeks: 3 },
        { title: 'Uygula',         icon: '⚡', weeks: 8 },
        { title: 'Değerlendir',    icon: '📊', weeks: 2 },
        { title: 'Sonuçlandır',    icon: '🏁', weeks: 2 },
    ],
};

export const SUBTASK_SUGGESTIONS = {
    egitim: ['Ders programı oluştur', 'Kaynak listesi hazırla', 'Çalışma ortamı düzenle', 'İlerlemeyi takip et', 'Pratik yap'],
    saglik: ['Doktora danış', 'Beslenme günlüğü tut', 'Egzersiz programı oluştur', 'Haftalık ölçüm al'],
    kariyer: ['Araştırma yap', 'Mentor bul', 'Network oluştur', 'Günlük hedef belirle', 'Geri bildirim al'],
    finans: ['Mevcut durumu analiz et', 'Bütçe oluştur', 'Tasarruf hesabı aç', 'Harcamaları takip et'],
    kisisel: ['Motivasyon kaynağı bul', 'Haftalık plan yap', 'İlerleme günlüğü tut', 'Destek al'],
    diger:   ['Araştırma yap', 'Plan oluştur', 'Adım adım ilerle', 'Değerlendir'],
};
