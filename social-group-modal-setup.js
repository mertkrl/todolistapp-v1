// social-group-modal-setup.js
// social.js'ten çıkarıldı (Faz H devamı): davet modalı kopyala butonu +
// premium grup oluşturma modalındaki erişim türü toggle'ı / sınıf-türüne
// göre alan değişimi / karakter sayaçları. Tamamen izole: hepsi kendi
// DOM elementlerini kendi içinde document.getElementById ile tekrar
// sorguluyor (script.js/planning.js'teki kanıtlanmış desenle aynı) —
// savePBtn/groupJoinBtn gibi social.js'te kalan kodlar bu elementlere
// closure üzerinden bağımlı değil, hepsi kendi getElementById çağrısını
// yapıyor.
export function setupGroupModalControls() {
    const inviteModal = document.getElementById("group-invite-modal");
    const closeInviteModal = document.getElementById("close-group-invite-modal");
    closeInviteModal?.addEventListener("click", () => inviteModal?.classList.add("hidden"));
    inviteModal?.addEventListener("click", (e) => { if (e.target === inviteModal) inviteModal.classList.add("hidden"); });

    const inviteModalCopyBtn = document.getElementById("group-invite-modal-copy-btn");
    inviteModalCopyBtn?.addEventListener("click", () => {
        const codeEl = document.getElementById("group-invite-modal-code");
        const code = codeEl ? codeEl.textContent : "";
        if (!code) return;
        const done = () => {
            const original = inviteModalCopyBtn.innerHTML;
            inviteModalCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { inviteModalCopyBtn.innerHTML = original; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(done);
        } else {
            done();
        }
    });

    // Grup erişim türü — minimalist iki seçenekli toggle
    const privacyToggle = document.getElementById("premium-group-privacy-toggle");
    const privacyInput = document.getElementById("premium-group-privacy");
    const setPrivacyValue = (value) => {
        if (privacyInput) privacyInput.value = value;
        privacyToggle?.querySelectorAll('.group-privacy-opt').forEach(b => {
            const active = b.dataset.value === value;
            b.classList.toggle('active', active);
            b.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    };
    privacyToggle?.querySelectorAll('.group-privacy-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            setPrivacyValue(btn.dataset.value);
        });
    });

    // Sınıf türü değişince "Grup Adı" alanının yerini "Kurum/Okul Adı" alır (sınıf/ders
    // veya iş yeri/ekip seçildiğinde grubun kendi adı yerine kurum adı istenir — sınıf/bölüm
    // ayrımına artık gerek yok); erişim türü de otomatik "Kapalı"ya kilitlenir.
    const classroomTypeSelect = document.getElementById("premium-group-classroom-type");
    const groupNameInput = document.getElementById("premium-group-name");
    const groupInstitutionInput = document.getElementById("premium-group-institution");
    const groupNameLabel = document.getElementById("premium-group-name-label");
    const toggleInstitutionFields = () => {
        if (!classroomTypeSelect) return;
        const isInstitutional = classroomTypeSelect.value !== 'general';

        if (groupNameLabel) groupNameLabel.textContent = isInstitutional ? 'Kurum / Okul Adı' : 'Grup Adı';
        // groupInstitutionInput'un temel CSS sınıfı display:none uyguluyor (varsayılan
        // olarak gizli) — style.display='' bu durumda inline stili sadece TEMİZLER, sınıf
        // kuralına geri düşer ve alan hiçbir zaman görünmez olur. 'block' ile açıkça ezmek
        // gerekiyor (önceden bu alan öğretmen için hiç görünmüyordu, kurum adı yazılamıyordu).
        if (groupNameInput) groupNameInput.style.display = isInstitutional ? 'none' : 'block';
        if (groupInstitutionInput) groupInstitutionInput.style.display = isInstitutional ? 'block' : 'none';

        const publicBtn = privacyToggle?.querySelector('.group-privacy-opt[data-value="public"]');
        if (publicBtn) publicBtn.disabled = isInstitutional;
        privacyToggle?.classList.toggle('is-locked', isInstitutional);
        if (isInstitutional) {
            setPrivacyValue('private');
        } else if (publicBtn) {
            publicBtn.disabled = false;
        }
    };
    classroomTypeSelect?.addEventListener('change', toggleInstitutionFields);
    toggleInstitutionFields();

    // Karakter sayaçları (Grup Adı / Kurum Adı / Açıklama) — hangi alan görünürse onun uzunluğunu sayar
    const pGroupNameInput = document.getElementById("premium-group-name");
    const pGroupNameCount = document.getElementById("premium-group-name-count");
    const updateNameCount = () => {
        if (!pGroupNameCount) return;
        const isInstitutional = classroomTypeSelect?.value !== 'general';
        const activeInput = isInstitutional ? groupInstitutionInput : pGroupNameInput;
        pGroupNameCount.textContent = `${activeInput?.value.length || 0}/${isInstitutional ? 60 : 30}`;
    };
    pGroupNameInput?.addEventListener("input", updateNameCount);
    groupInstitutionInput?.addEventListener("input", updateNameCount);
    classroomTypeSelect?.addEventListener('change', updateNameCount);
    updateNameCount();

    const pGroupDescInput = document.getElementById("premium-group-desc");
    const pGroupDescCount = document.getElementById("premium-group-desc-count");
    pGroupDescInput?.addEventListener("input", () => {
        if (pGroupDescCount) pGroupDescCount.textContent = `${pGroupDescInput.value.length}/200`;
    });
}
