// ─── ÖZEL SAAT SEÇİCİ WIDGET'I ──────────────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Görev/etkinlik/
// sihirbaz formlarındaki "sonsuz kaydırma" saat seçici (dropdown liste,
// 3 tur kopyalanmış saat listesiyle infinite-scroll hissi verir).
// Paylaşılan state (tasks/habits/goals/calendarEvents) dokunmuyor — saf
// DOM widget'ı.
//
// ÖNEMLİ: script.js'in kendi DOMContentLoaded'ının EN ÜST SEVİYESİNDE
// (bir fonksiyon içinde değil) window.initCustomTimePicker(...) 6 kez
// senkron çağrılıyor (task/event/wizard başlangıç-bitiş kutuları için).
// Bu script.js gibi normal <script type="module" src="..."> ile (dynamic
// import() DEĞİL) yüklendiği için sıra ÖNEMLİ DEĞİL: tüm modül script'leri
// DOMContentLoaded ateşlenmeden ÖNCE top-level kodlarını çalıştırır (defer
// semantiği), bu yüzden index.html'de bu dosyanın script.js'ten önce ya da
// sonra olması fark etmez.
//
// window.updateEndPicker de script.js'in addTask/openEventModal gibi başka
// fonksiyonlarından (deferred, olay tetikleyicili) çağrılıyor — onlar için
// zaten sıra sorunu yok.

const timeOptionsList = [];
for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
        timeOptionsList.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
}
// 23:59 sınırı tamamen kaldırıldı, menü 23:30'dan sonra otomatik 00:00'a atlamaya hazır.

export function updateEndPicker(inputIdPrefix, newTime) {
    const display = document.getElementById(`${inputIdPrefix}-display`);
    const input = document.getElementById(inputIdPrefix);
    const dropdown = document.getElementById(`${inputIdPrefix}-dropdown`);

    if (display && input) {
        display.textContent = newTime;
        input.value = newTime;
    }

    if (dropdown) {
        dropdown.querySelectorAll('.custom-time-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.textContent === newTime) opt.classList.add('selected');
        });
    }
}
window.updateEndPicker = updateEndPicker;

export function initCustomTimePicker(boxId, displayId, inputId, dropdownId, onChangeCallback = null) {
    const box = document.getElementById(boxId);
    const display = document.getElementById(displayId);
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!box || !dropdown || !input) return;

    dropdown.innerHTML = '';

    const loopCount = 3; // Sonsuzluk hissi için listeyi 3 kez kopyalıyoruz
    let targetLi = null;

    // Listeyi 3 tur yazdır
    for (let i = 0; i < loopCount; i++) {
        timeOptionsList.forEach(time => {
            const li = document.createElement('li');
            li.className = 'custom-time-option';
            li.textContent = time;

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                display.textContent = time;
                input.value = time;

                dropdown.classList.remove('show');
                box.classList.remove('active');
                if (onChangeCallback) onChangeCallback(time);
            });
            dropdown.appendChild(li);
        });
    }

    // --- YENİ EKLENEN: Gerçek Sonsuz Döngü (Infinite Scroll) Sihri ---
    dropdown.addEventListener('scroll', () => {
        const oneCycleHeight = dropdown.scrollHeight / loopCount;

        // Kullanıcı en tepeye kaydırırsa, hissettirmeden orta döngüye ışınla
        if (dropdown.scrollTop < 10) {
            dropdown.scrollTop += oneCycleHeight;
        }
        // Kullanıcı en aşağı kaydırırsa, hissettirmeden orta döngüye ışınla
        else if (dropdown.scrollTop + dropdown.clientHeight > dropdown.scrollHeight - 10) {
            dropdown.scrollTop -= oneCycleHeight;
        }
    }, { passive: true });

    box.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-time-dropdown').forEach(d => {
            if (d !== dropdown) { d.classList.remove('show'); d.classList.add('hidden'); }
        });
        document.querySelectorAll('.time-box').forEach(b => {
            if (b !== box) b.classList.remove('active');
        });

        // 'hidden' sınıfı 'display:none !important' uyguladığından, açılırken kaldırılmalı
        dropdown.classList.remove('hidden');
        dropdown.classList.toggle('show');
        box.classList.toggle('active');
        if (!dropdown.classList.contains('show')) dropdown.classList.add('hidden');

        if (dropdown.classList.contains('show')) {
            // Menü açıldığında her zaman ORTADAKİ döngüdeki saati bul ve oraya odaklan
            const options = Array.from(dropdown.children);
            const middleStartIndex = timeOptionsList.length;
            const middleEndIndex = timeOptionsList.length * 2;

            let currentSelected = options.find((child, index) => {
                return child.textContent === input.value && index >= middleStartIndex && index < middleEndIndex;
            });

            if (currentSelected) {
                options.forEach(opt => opt.classList.remove('selected'));
                currentSelected.classList.add('selected');
                // Menüyü tam o saatin üzerine ortala
                dropdown.scrollTop = currentSelected.offsetTop - (dropdown.clientHeight / 2) + (currentSelected.clientHeight / 2);
            }
        }
    });
}
window.initCustomTimePicker = initCustomTimePicker;

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-time-dropdown').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.time-box').forEach(b => b.classList.remove('active'));
});
