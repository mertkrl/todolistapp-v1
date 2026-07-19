// ============================================================
// FOCUSAI SCRIPT-MIND-DUMP-DRAWER.JS
// script.js'ten çıkarılmış takvim ekranındaki "Zihin Çöplüğü" mini
// çekmecesi. mindDumps state'ini script.js'in export ettiği
// getMindDumpsRef() üzerinden okuyor (ES module import). script.js'ten
// SONRA yüklenmeli.
//
// Not: script.js'te AYNI işi yapan eski/yedek bir window.renderCalMindDump
// fonksiyonu daha var (basit sürüm, "Takvime Planla" butonu yok) — o atama
// script.js'in KENDİ DOMContentLoaded handler'ının içinde çalışıyor. İkimiz
// de module script olarak deferred çalışıyoruz ama script.js'in
// DOMContentLoaded listener'ı ondan önce (modül sırasına göre önce
// yüklendiği için) kayıt olduğundan önce çalışır, bizimki ondan sonra
// çalışıp üzerine yazar (kayıt sırası = çalışma sırası — module olsak da
// bu garanti değişmedi).
// ============================================================
import { escapeHtml, FocusStorage } from './storage-manager.js';
import { getMindDumpsRef } from './script.js';

(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

// ==========================================================================
// YENİ: PREMIUM ZİHİN ÇÖPLÜĞÜ TAKVİM ÇEKMECESİ (PROBLEM DÜZELTMELİ SÜRÜM)
// ==========================================================================
const calMindDumpToggle = document.getElementById('cal-mind-dump-toggle');
const calMindDumpDrawer = document.getElementById('cal-mind-dump-drawer');
const closeCalMindDumpBtn = document.getElementById('close-cal-mind-dump');
const calMindDumpList = document.getElementById('cal-mind-dump-list');

// Sayfa ilk açıldığında mini modalın KESİNLİKLE kapalı başlamasını garanti ediyoruz
if (calMindDumpDrawer) {
    calMindDumpDrawer.style.display = 'none';
}

function renderCalMindDump() {
    if (!calMindDumpList) return;

    // Listeyi temizle
    calMindDumpList.innerHTML = '';

    // DÜZELTME: Orijinal zihin çöplüğü verilerini sistemin kendi değişkeninden (mindDumps) çekiyoruz
    const mindDumpItems = getMindDumpsRef() || FocusStorage.get('mind_dumps', []);

    if (!mindDumpItems || mindDumpItems.length === 0) {
        calMindDumpList.innerHTML = `<li style="background: transparent !important; border: 1px dashed rgba(255,255,255,0.15) !important; color: rgba(255,255,255,0.4) !important; justify-content: center !important; cursor: default !important;">
            <i class="fa-solid fa-tray-empty" style="margin-right: 6px;"></i> Havuz şu an boş.
        </li>`;
        return;
    }

    // Fikirleri ters kronolojik (en yeni en üstte) listeliyoruz
    [...mindDumpItems].reverse().forEach((item) => {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-id', item.id);

        const itemText = escapeHtml(item.text || item);

        li.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85%;">
                <i class="fa-solid fa-grip-vertical" style="color: rgba(255,255,255,0.3); font-size: 11px; cursor: grab;"></i>
                ${itemText}
            </span>
            <button class="cal-dump-plan-btn" title="Takvime Planla" style="background: transparent; border: none; color: #a29bfe; cursor: pointer; font-size: 13px; transition: transform 0.2s, color 0.2s;">
                <i class="fa-solid fa-calendar-plus"></i>
            </button>
        `;

        const planBtn = li.querySelector('.cal-dump-plan-btn');
        planBtn.addEventListener('click', () => {
            if (typeof window.openConvertModal === 'function') window.openConvertModal(item.id);
        });
        planBtn.addEventListener('mouseover', () => {
            planBtn.style.color = '#2ed573';
            planBtn.style.transform = 'scale(1.2)';
        });
        planBtn.addEventListener('mouseout', () => {
            planBtn.style.color = '#a29bfe';
            planBtn.style.transform = 'scale(1)';
        });

        // Sürükle bırak olayları (Takvim günü drop mekanizmasıyla entegre)
        li.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData('taskId', item.id);
            }
            li.style.opacity = '0.4';
        });

        li.addEventListener('dragend', () => {
            li.style.opacity = '1';
        });

        calMindDumpList.appendChild(li);
    });
}

// Buton Tıklama ve Açılış/Kapanış Kontrolleri
if(calMindDumpToggle && calMindDumpDrawer) {
    calMindDumpToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (calMindDumpDrawer.style.display === 'none' || calMindDumpDrawer.classList.contains('hidden')) {
            calMindDumpDrawer.classList.remove('hidden');
            calMindDumpDrawer.style.display = 'block';
            renderCalMindDump();
        } else {
            calMindDumpDrawer.style.display = 'none';
        }
    });

    if (closeCalMindDumpBtn) {
        closeCalMindDumpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calMindDumpDrawer.style.display = 'none';
        });
    }
}

window.renderCalMindDump = renderCalMindDump;

});
})();
