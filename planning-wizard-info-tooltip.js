// ── Wizard Info Tooltip Sistemi → planning.js'ten taşındı ────────────────
const WZ_INFO_TEXTS = {
    title: {
        title: 'Hedef Başlığı',
        text: 'Hedefinizi net ve ölçülebilir yazın. "Bir şeyler öğren" yerine "B2 seviyesine ulaş" veya "10K koşabilir hale gel" gibi somut ifadeler daha etkilidir.',
    },
    category: {
        title: 'Kategori',
        text: 'Hedefinizin hangi alana ait olduğunu belirler. Seçtiğiniz kategoriye göre size özel dönüm noktası şablonları önerilir ve hedefleriniz gruplandırılır.',
    },
    priority: {
        title: 'Öncelik',
        text: 'Yüksek öncelikli hedefler sprint görünümünde öne çıkar ve deadline yaklaştığında bildirimler daha erken gelir. Aynı anda çok fazla "yüksek öncelik" belirlenmemelidir.',
    },
    deadline: {
        title: 'Son Tarih',
        text: 'Hedefinizin bitiş tarihi. Sistem bu tarihe göre dönüm noktalarınızı otomatik olarak zaman çizelgesine dağıtır. Net bir deadline koymak tamamlanma oranını önemli ölçüde artırır.',
    },
    motivation: {
        title: 'Neden önemli?',
        text: '"Neden" sorusu zorlu dönemlerde sizi ayakta tutar. Ne kadar kişisel ve spesifik yazarsanız o kadar güçlü bir motivasyon kaynağı olur — özellikle duraksadığınız anlarda hatırlatıcı olarak çalışır.',
    },
    mode: {
        title: 'Planlama Modu',
        text: '🧑‍💻 Solo: Tüm kontrolü siz yönetirsiniz, hedef sadece size ait.\n\n🤝 Ortaklaşa: Arkadaşlarınızı davet edebilirsiniz. Her birinizin milestone\'larını işaretlemesi anında diğerine yansır. Ortak proje, çift öğrenme, partner egzersiz gibi senaryolar için idealdir.',
    },
    milestones: {
        title: 'Dönüm Noktaları',
        text: 'Büyük hedefleri küçük adımlara bölmek başarı şansını önemli ölçüde artırır. Her dönüm noktası size ilerleme hissi verir ve hedefinizin yönetilebilir görünmesini sağlar.\n\nBirden fazla seçebilir, sıralayabilir ve özel dönüm noktası ekleyebilirsiniz.',
    },
    work_days: {
        title: 'Çalışma Günlerin',
        text: 'Haftanın hangi günleri bu hedefe zaman ayıracağınızı belirtin. Sprint görünümü buna göre haftalık yükünüzü dengeler ve fazla yüklenmemenizi önler.',
    },
    hours: {
        title: 'Haftalık Süre',
        text: 'Bu hedefe haftada kaç saat ayırabileceğinizi girin. Sistem bu bilgiyle toplam süre hesabı yapar.\n\nGerçekçi olun — fazla tahmin hayal kırıklığına yol açar. Başlangıçta az tutup ilerledikçe artırabilirsiniz.',
    },
    ms_detail: {
        title: 'Aşama Detayları',
        text: 'Her dönüm noktası için:\n\n✅ Başarı kriteri: "Tamamlandı" kararını kolaylaştırır\n📋 Alt görevler: Aşamayı küçük parçalara böler\n📚 Kaynaklar: Kitap, kurs, link ekleyebilirsiniz\n\nTüm alanlar isteğe bağlıdır, sonradan da düzenleyebilirsiniz.',
    },
    criteria: {
        title: 'Başarı Kriteri',
        text: 'Bu aşamayı ne zaman tamamlamış sayılacağınızı önceden belirleyin.\n\nÖrnekler:\n• "A1 sınavını geçtim"\n• "İlk prototip çalışıyor"\n• "5K koşabildim"\n\nNet bir kriter, belirsizliği ortadan kaldırır ve motivasyonu artırır.',
    },
};

function _wzShowInfoTip(btn) {
    const key = btn.dataset.info;
    const info = WZ_INFO_TEXTS[key];
    if (!info) return;

    let tip = document.getElementById('pg-wz-info-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'pg-wz-info-tooltip';
        tip.className = 'pg-wz-info-tooltip';
        document.body.appendChild(tip);
    }

    // Toggle same button
    if (tip._activeBtn === btn && tip.classList.contains('show')) {
        tip.classList.remove('show');
        tip._activeBtn = null;
        return;
    }
    tip._activeBtn = btn;

    // Render content (newlines → line breaks)
    tip.innerHTML = `<div class="pg-wz-tip-title">${window.escapeHtml(info.title)}</div>
        <div class="pg-wz-tip-text">${window.escapeHtml(info.text).replace(/\\n/g, '\n').replace(/\n/g, '<br>')}</div>`;

    tip.classList.remove('show');
    tip.classList.remove('pg-wz-tip-above');

    // Position
    const rect = btn.getBoundingClientRect();
    const tipW = 280;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
    tip.style.left = left + 'px';
    tip.style.width = tipW + 'px';

    // Show below by default; flip above if near bottom
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 200) {
        tip.style.top = '';
        tip.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        tip.classList.add('pg-wz-tip-above');
    } else {
        tip.style.bottom = '';
        tip.style.top = (rect.bottom + 8) + 'px';
    }

    requestAnimationFrame(() => tip.classList.add('show'));
}

function _wzBindInfoBtns() {
    document.querySelectorAll('.pg-wz-info-btn').forEach(btn => {
        if (btn._infoBound) return;
        btn._infoBound = true;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            _wzShowInfoTip(btn);
        });
    });
    // Global click to close
    if (!document._wzInfoClose) {
        document._wzInfoClose = true;
        document.addEventListener('click', () => {
            const tip = document.getElementById('pg-wz-info-tooltip');
            if (tip) { tip.classList.remove('show'); tip._activeBtn = null; }
        });
    }
}
window._wzBindInfoBtns = _wzBindInfoBtns;
