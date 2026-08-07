// --- AYARLAR: OTO-LİMİT VE +/- BUTONLARI → script.js'ten taşındı ---
document.addEventListener('DOMContentLoaded', () => {

    // Artı ve Eksi Butonlarına tıklandığında süreyi ayarlama
    document.querySelectorAll('.setting-minus, .setting-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            const input = document.getElementById(targetId);
            let val = parseInt(input.value);
            const min = parseInt(input.min);
            const max = parseInt(input.max);

            if (isNaN(val)) val = min;

            if (e.currentTarget.classList.contains('setting-minus')) {
                val = val - 1;
            } else {
                val = val + 1;
            }

            // Limitleri zorla
            if (val < min) val = min;
            if (val > max) val = max;

            input.value = val;
        });
    });

    // Kullanıcı klavyeden kendisi rakam girerse otomatik düzelt (Oto-Limit)
    document.querySelectorAll('.setting-input').forEach(input => {
        input.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            const min = parseInt(e.target.min);
            const max = parseInt(e.target.max);

            // Eğer harf girerse, boş bırakırsa veya min limitten küçük (örn 0) girerse -> Min yap
            if (isNaN(val) || val < min) val = min;

            // Eğer maksimum limitten (örn 120) büyük girerse -> Max yap
            if (val > max) val = max;

            e.target.value = val;
        });
    });

});
