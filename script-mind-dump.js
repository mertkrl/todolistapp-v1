// ─── ZİHİN ÇÖPLÜĞÜ (MIND DUMP) — LİSTE/ETİKET YÖNETİMİ ─────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Hızlı fikir/not
// ekleme, etiketleme (preset + özel etiketler), arama/filtreleme, düzenleme,
// silme (undo destekli) — zihin çöplüğü listesinin TAMAMI. "Dönüştür"
// modalının kendisi (göreve/hedefe/alışkanlığa dönüştürme akışı) BİLİNÇLİ
// OLARAK script.js'te bırakıldı — addSmartTask/habits.push/renderCalendar
// gibi çekirdek görev-habit-takvim sistemine çok bağımlı, ayrı ve daha riskli
// bir gelecek aday (bkz. script.js'teki "SİSTEME EKLE BUTONU" bloğu,
// window.openConvertModal/closeConvertModal orada kalıyor). Bu dosyadaki
// `openConvertModal(id)` çağrısı (dump listesindeki "Dönüştür" butonu) bare
// identifier olarak kalabildi çünkü window.openConvertModal zaten global
// fallthrough ile çözülüyor (script.js'in kendi header yorumundaki
// escapeHtml mekanizmasıyla aynı).
//
// Dış bağımlılıklar (script.js'te kalıyor, window.* köprüsüyle açıldı):
// - mindDumps → getMindDumpsRef() (script.js'te ÖNCEDEN var olan
//   salt-okunur getter — bu kümede sadece push/splice/find gibi mutasyon var,
//   reassignment yok, bu yüzden setter gerekmedi)
// - generateId, showPremiumModal, renderCalMindDump → window.*
// - escapeHtml, Store, showUndoToast, openConvertModal, deleteMindDump,
//   startDumpEdit, toggleDumpTagPicker, selectDumpInlineTag, changeDumpTag →
//   zaten global (bare identifier, window-fallthrough mekanizmasıyla çalışır
//   — bazıları bu dosyanın kendisinde window.X=function() olarak tanımlı)
//
// Dışa açılan köprüler (script.js'in KALAN "Dönüştür" modalı gibi
// yerlerinin çağırabilmesi için): window.saveMindDumps, window.renderMindDumps.
//
// Yükleme sırası önemsiz — script.js ve kardeşleri dynamic import() değil
// normal <script type="module" src="..."> ile yükleniyor.

import { getMindDumpsRef, showPremiumModal, renderCalMindDump } from './script.js';
import { generateId } from './storage-manager.js';

// Zihin çöplüğü, işlenmeyi bekleyen fikirlerin BİRİKMEMESİ için sert bir üst
// sınıra sahip — sınırsız birikim, işleme motivasyonunu öldürüp gerçek bir
// "çöplüğe" dönüştürüyor (dijital biriktiricilik / karar yorgunluğu). Sert
// tavan, düzenli işlemeyi zorunlu kılar; 10+ öğede zaten yumuşak bir
// "temizle" bandı gösteriliyor.
const MAX_MIND_DUMPS = 30;

 export function saveMindDumps() {
     Store.mind_dumps.set(getMindDumpsRef());
 }
 window.saveMindDumps = saveMindDumps;

 // Göreli zaman (yaş göstergesi)
 function dumpRelativeTime(timestamp) {
     const diff = Date.now() - timestamp;
     const mins = Math.floor(diff / 60000);
     if (mins < 1) return 'Az önce';
     if (mins < 60) return `${mins} dakika önce`;
     const hours = Math.floor(mins / 60);
     if (hours < 24) return `${hours} saat önce`;
     const days = Math.floor(hours / 24);
     if (days === 1) return 'Dün';
     if (days < 7) return `${days} gün önce`;
     const weeks = Math.floor(days / 7);
     if (weeks === 1) return '1 hafta önce';
     if (weeks < 5) return `${weeks} hafta önce`;
     const months = Math.floor(days / 30);
     return `${months} ay önce`;
 }

 // Etiket renk/metin tablosu
 // Sabit etiket renk paleti (özel etiketler de bu renklerden döngüsel olarak alır)
 const DUMP_CUSTOM_TAG_COLORS = [
     { color: '#00cec9', bg: 'rgba(0,206,201,0.12)',   border: 'rgba(0,206,201,0.25)'   },
     { color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
     { color: '#55efc4', bg: 'rgba(85,239,196,0.12)',  border: 'rgba(85,239,196,0.25)'  },
     { color: '#ffeaa7', bg: 'rgba(255,234,167,0.12)', border: 'rgba(255,234,167,0.25)' },
     { color: '#b2bec3', bg: 'rgba(178,190,195,0.12)', border: 'rgba(178,190,195,0.25)' },
 ];
 const DUMP_CUSTOM_TAG_MAX = 5;

 const DUMP_PRESET_TAGS = {
     'ana-hedef':  { label: '🎯 Ana Hedef',  color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
     'aliskanlik': { label: '🔥 Alışkanlık', color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
     'fikir':      { label: '💡 Fikir',       color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)', border: 'rgba(253,203,110,0.25)' },
     'diger':      { label: '📦 Diğer',       color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
     // Geriye dönük uyum (eski kayıtlar)
     'endise':       { label: '😟 Endişe',      color: '#e17055', bg: 'rgba(225,112,85,0.12)',  border: 'rgba(225,112,85,0.25)'  },
     'hatirlatici':  { label: '📌 Hatırlatıcı', color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
     'soru':         { label: '❓ Soru',         color: '#74b9ff', bg: 'rgba(116,185,255,0.12)', border: 'rgba(116,185,255,0.25)' },
 };

 function getDumpCustomTags() {
     return FocusStorage.get('dump_custom_tags', []);
 }
 function saveDumpCustomTags(tags) {
     FocusStorage.set('dump_custom_tags', tags);
 }

 // Tüm tag meta (preset + özel) birleştirir
 function getDumpTagMeta() {
     const custom = getDumpCustomTags();
     const meta = { ...DUMP_PRESET_TAGS };
     custom.forEach((t, i) => {
         const c = DUMP_CUSTOM_TAG_COLORS[i % DUMP_CUSTOM_TAG_COLORS.length];
         meta[t.id] = { label: t.label, ...c };
     });
     return meta;
 }

 // Geriye dönük uyum için dumpTagMeta alias
 const dumpTagMeta = new Proxy({}, { get(_, k) { return getDumpTagMeta()[k]; } });

 let dumpSearchQuery = '';
 let dumpActiveTag = 'all';
 let dumpInlineSelectedTag = 'diger';

 function renderDumpInlineTagRow() {
     const row = document.getElementById('dump-inline-tag-row');
     if (!row) return;
     const meta = getDumpTagMeta();
     const customTags = getDumpCustomTags();
     const VISIBLE = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
     const allKeys = [...VISIBLE, ...customTags.map(t => t.id)];
     row.innerHTML = allKeys.map(key => {
         const info = meta[key] || meta['diger'];
         const isActive = key === dumpInlineSelectedTag;
         return `<button class="dump-inline-tag-chip${isActive ? ' active' : ''}"
             data-action="select-dump-inline-tag" data-tag="${key}">${escapeHtml(info.label)}</button>`;
     }).join('');
     row.querySelectorAll('.dump-inline-tag-chip.active').forEach(btn => {
         const key = btn.dataset.tag;
         const info = meta[key] || meta['diger'];
         btn.style.color = info.color;
         btn.style.background = info.bg;
         btn.style.borderColor = info.border;
     });
 }

 // renderMindDumps'tan ayrılan: tek bir zihin çöplüğü öğesinin <li> elementini kurar.
 // Faz S devamı, dev fonksiyon refactoru.
 function _dumpBuildItemEl(dump) {
         const ageStr = dumpRelativeTime(dump.timestamp);
         const tagKey = dump.tag || 'diger';
         const _metaAll = getDumpTagMeta();
         const tagInfo = _metaAll[tagKey] || _metaAll['diger'];
         const ageDays = (Date.now() - dump.timestamp) / (1000 * 60 * 60 * 24);
         const ageClass = ageDays > 14 ? 'dump-age-critical'
                        : ageDays > 7  ? 'dump-age-old'
                        : ageDays > 3  ? 'dump-age-stale'
                        : '';
         const ageWarnLabel = ageDays > 14 ? '🔴 Kritik'
                            : ageDays > 7  ? '🟠 Bayatladı'
                            : ageDays > 3  ? '🟡 Eski'
                            : '';
         const isOld = ageDays > 3;

         const li = document.createElement('li');
         li.className = 'dump-item' + (ageClass ? ' ' + ageClass : '');
         li.dataset.dumpId = dump.id;
         li.innerHTML = `
             <div class="dump-info">
                 <div class="dump-title-row">
                     <span class="dump-title" title="Düzenlemek için çift tıkla">${escapeHtml(dump.text)}</span>
                     <span class="dump-tag-badge" title="Etiket">${escapeHtml(tagInfo.label)}</span>
                 </div>
                 <span class="dump-date">
                     <i class="fa-regular fa-clock"></i> ${ageStr}
                     ${isOld ? `<span class="dump-age-warn">${ageWarnLabel}</span>` : ''}
                 </span>
             </div>
             <div class="dump-actions">
                 <button class="dump-edit-btn" data-action="edit-dump" data-id="${dump.id}" title="Düzenle" aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                 <button class="dump-convert-btn" data-action="convert-dump" data-id="${dump.id}" title="Dönüştür" aria-label="Dönüştür"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                 <button class="dump-del-btn" data-action="delete-dump" data-id="${dump.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
             </div>
         `;
         const tagBadge = li.querySelector('.dump-tag-badge');
         if (tagBadge) {
             tagBadge.style.color = tagInfo.color;
             tagBadge.style.background = tagInfo.bg;
             tagBadge.style.borderColor = tagInfo.border;
         }
         // Çift tıklama ile inline düzenleme
         li.querySelector('.dump-title').addEventListener('dblclick', () => startDumpEdit(dump.id));
     return li;
 }

 export function renderMindDumps() {
     const dumpList = document.getElementById('dump-list');
     if(!dumpList) return;
     dumpList.innerHTML = '';
     renderDumpFilterBtns();
     renderDumpInlineTagRow();

     // ── Dönüşüm özeti ──────────────────────────────────────
     const convLog = FocusStorage.get('mind_dump_conversions', []);
     const convertedCount = convLog.length;
     const totalEver = convertedCount + getMindDumpsRef().length;
     const convRate = totalEver > 0 ? Math.round((convertedCount / totalEver) * 100) : 0;

     // Header meta chip'leri güncelle
     const headerMeta = document.getElementById('dump-header-meta');
     const hChipCount = document.getElementById('dump-hchip-count');
     const hChipRate  = document.getElementById('dump-hchip-rate');
     if (headerMeta) {
         if (getMindDumpsRef().length === 0 && convertedCount === 0) {
             headerMeta.style.display = 'none';
         } else {
             headerMeta.style.display = 'flex';
             if (hChipCount) hChipCount.textContent = `${getMindDumpsRef().length} düşünce`;
             if (hChipRate)  hChipRate.textContent  = `%${convRate} dönüştürüldü`;
         }
     }

     // Limite yaklaşınca/dolunca "Fırlat" butonunu görsel olarak uyar
     if (dumpInlineSubmitBtn) {
         const dumpAtLimit = getMindDumpsRef().length >= MAX_MIND_DUMPS;
         dumpInlineSubmitBtn.style.opacity = dumpAtLimit ? '0.55' : '';
         dumpInlineSubmitBtn.title = dumpAtLimit ? `Zihin çöplüğü dolu (${MAX_MIND_DUMPS}/${MAX_MIND_DUMPS}) — önce işle ya da temizle.` : '';
     }

     // Stats şeridi (bekleyen / dönüştürüldü / bayatlıyor / eyleme geçiş) kaldırıldı.
     const _oldStatsEl = document.getElementById('dump-stats-strip');
     if (_oldStatsEl) _oldStatsEl.remove();

     // Temizleme hatırlatıcısı
     const banner = document.getElementById('dump-cleanup-banner');
     const bannerText = document.getElementById('dump-cleanup-text');
     const CLEANUP_THRESHOLD = 10;
     const dismissed = FocusStorage.get('dump_banner_dismissed_at', 0);
     const daysSinceDismiss = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
     if (banner) {
         if (getMindDumpsRef().length >= CLEANUP_THRESHOLD && daysSinceDismiss > 7) {
             if (bannerText) bannerText.textContent = `Zihin çöplüğünde ${getMindDumpsRef().length} bekleyen öğe var — işleme vakti! 🧹`;
             banner.style.display = 'flex';
         } else {
             banner.style.display = 'none';
         }
     }

     // Filtreleme
     let filtered = [...getMindDumpsRef()].reverse();
     if (dumpSearchQuery) {
         const q = dumpSearchQuery.toLowerCase();
         filtered = filtered.filter(d => d.text.toLowerCase().includes(q));
     }
     if (dumpActiveTag !== 'all') {
         filtered = filtered.filter(d => (d.tag || 'diger') === dumpActiveTag);
     }

     if (filtered.length === 0) {
         if (getMindDumpsRef().length === 0) {
             dumpList.innerHTML = '<li class="dump-empty">🎉 Zihin çöplüğün tertemiz. <button data-action="focus-dump-textarea" class="dump-empty-cta">Bir şeyler fırlat →</button></li>';
         } else {
             dumpList.innerHTML = '<li class="dump-empty">Bu filtreyle eşleşen öğe yok.</li>';
         }
         return;
     }

     filtered.forEach(dump => { dumpList.appendChild(_dumpBuildItemEl(dump)); });
 }
 window.renderMindDumps = renderMindDumps;

 // Inline dump input
 const dumpInlineTextarea = document.getElementById('dump-inline-textarea');
 const dumpInlineSubmitBtn = document.getElementById('dump-inline-submit');

 // ─── Filtre butonlarını (toolbar) dinamik render et ───
 function renderDumpFilterBtns() {
     const container = document.getElementById('dump-tag-filters');
     if (!container) return;
     const meta = getDumpTagMeta();
     const customTags = getDumpCustomTags();
     const VISIBLE_PRESET = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
     const allTags = [null, ...VISIBLE_PRESET, ...customTags.map(t => t.id)]; // null = "Tümü"
     container.innerHTML = allTags.map(tag => {
         if (!tag) return `<button class="dump-tag-filter-btn${dumpActiveTag === 'all' ? ' active' : ''} u-white-space-nowrap" data-tag="all" >Tümü</button>`;
         const m = meta[tag] || meta.diger;
         return `<button class="dump-tag-filter-btn${dumpActiveTag === tag ? ' active' : ''} u-white-space-nowrap" data-tag="${tag}" >${escapeHtml(m.label)}</button>`;
     }).join('');
     container.querySelectorAll('.dump-tag-filter-btn').forEach(btn => {
         btn.addEventListener('click', () => {
             container.querySelectorAll('.dump-tag-filter-btn').forEach(b => b.classList.remove('active'));
             btn.classList.add('active');
             dumpActiveTag = btn.dataset.tag;
             renderMindDumps();
         });
     });
 }


 // ─── Özel etiket ekle ───
 // ─── Özel Etiket Yönetim Modalı ───────────────────────────────────────────
 const _dumpTagMgrModal  = document.getElementById('dump-tag-manager-modal');
 const _dumpTagInput     = document.getElementById('dump-new-tag-input');
 const _dumpTagSaveBtn   = document.getElementById('dump-tag-save-btn');
 const _dumpTagError     = document.getElementById('dump-tag-error');
 const _dumpTagCharCount = document.getElementById('dump-tag-char-count');
 const _dumpTagCounter   = document.getElementById('dump-tag-manager-counter');
 const _dumpTagList      = document.getElementById('dump-custom-tag-list');
 const _dumpNoTags       = document.getElementById('dump-no-custom-tags');
 const _dumpTagAddArea   = document.getElementById('dump-tag-add-area');

 function _refreshTagManager() {
     const custom = getDumpCustomTags();
     const atMax  = custom.length >= DUMP_CUSTOM_TAG_MAX;

     if (_dumpTagCounter) _dumpTagCounter.textContent = `${custom.length} / ${DUMP_CUSTOM_TAG_MAX} etiket`;
     if (_dumpTagAddArea) _dumpTagAddArea.style.opacity = atMax ? '0.45' : '1';
     if (_dumpTagInput)   _dumpTagInput.disabled = atMax;
     if (_dumpTagSaveBtn) {
         _dumpTagSaveBtn.disabled = atMax;
         _dumpTagSaveBtn.style.opacity = atMax ? '0.4' : '1';
         _dumpTagSaveBtn.style.cursor  = atMax ? 'not-allowed' : 'pointer';
     }

     if (_dumpTagList) {
         if (custom.length === 0) {
             _dumpTagList.innerHTML = '';
             if (_dumpNoTags) _dumpNoTags.style.display = 'block';
         } else {
             if (_dumpNoTags) _dumpNoTags.style.display = 'none';
             _dumpTagList.innerHTML = '';
             custom.forEach((t, i) => {
                 const c = DUMP_CUSTOM_TAG_COLORS[i % DUMP_CUSTOM_TAG_COLORS.length];
                 const li = document.createElement('li');
                 li.style.display = 'flex';
                 li.style.alignItems = 'center';
                 li.style.gap = '10px';
                 li.style.padding = '8px 12px';
                 li.style.borderRadius = '10px';
                 li.style.background = 'rgba(255,255,255,0.03)';
                 li.style.border = '1px solid rgba(255,255,255,0.07)';
                 const dot = document.createElement('span');
                 dot.style.width = '8px';
                 dot.style.height = '8px';
                 dot.style.borderRadius = '50%';
                 dot.style.background = c.color;
                 dot.style.flexShrink = '0';
                 dot.style.display = 'inline-block';
                 const lbl = document.createElement('span');
                 lbl.textContent = t.label;
                 lbl.style.flex = '1';
                 lbl.style.fontSize = '13px';
                 lbl.style.color = '#fff';
                 lbl.style.fontWeight = '500';
                 const delBtn = document.createElement('button');
                 delBtn.type = 'button';
                 delBtn.title = 'Etiketi sil';
                 // inline-flex + açık kırmızı renk + SVG ikon (FA bağımlılığı yok)
                 delBtn.style.width = '30px';
                 delBtn.style.height = '30px';
                 delBtn.style.minWidth = '30px';
                 delBtn.style.borderRadius = '8px';
                 delBtn.style.border = '1px solid #ff7675';
                 delBtn.style.background = 'rgba(255,71,87,0.12)';
                 delBtn.style.setProperty('color', '#ff7675', 'important');
                 delBtn.style.cursor = 'pointer';
                 delBtn.style.display = 'inline-flex';
                 delBtn.style.alignItems = 'center';
                 delBtn.style.justifyContent = 'center';
                 delBtn.style.flexShrink = '0';
                 delBtn.style.padding = '0';
                 delBtn.style.boxSizing = 'border-box';
                 delBtn.style.fontSize = '14px';
                 delBtn.style.lineHeight = '1';
                 delBtn.style.overflow = 'visible';
                 delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff7675" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="u-pointer-events-none_display-block"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
                 delBtn.addEventListener('mouseover', () => { delBtn.style.background = 'rgba(255,71,87,0.28)'; delBtn.style.borderColor = '#ff4757'; });
                 delBtn.addEventListener('mouseout',  () => { delBtn.style.background = 'rgba(255,71,87,0.12)'; delBtn.style.borderColor = '#ff7675'; });
                 delBtn.addEventListener('click', () => window._deleteDumpCustomTag(t.id));
                 li.appendChild(dot);
                 li.appendChild(lbl);
                 li.appendChild(delBtn);
                 _dumpTagList.appendChild(li);
             });
         }
     }
     if (_dumpTagInput) { _dumpTagInput.value = ''; if (_dumpTagCharCount) _dumpTagCharCount.textContent = '0/16'; }
     if (_dumpTagError) _dumpTagError.style.display = 'none';
 }

 window._deleteDumpCustomTag = function(id) {
     let custom = getDumpCustomTags();
     custom = custom.filter(t => t.id !== id);
     saveDumpCustomTags(custom);
     _refreshTagManager();
     renderDumpFilterBtns();
 };

 function _saveDumpCustomTag() {
     if (!_dumpTagInput) return;
     const raw   = _dumpTagInput.value.trim();
     const label = raw.slice(0, 16);
     if (!label) { _showDumpTagError('Etiket adı boş olamaz.'); return; }

     const custom  = getDumpCustomTags();
     const presets = ['Ana Hedef', 'Alışkanlık', 'Fikir', 'Diğer'];
     const allNames = [
         ...presets.map(n => n.toLowerCase()),
         ...custom.map(t => t.label.toLowerCase())
     ];
     if (allNames.includes(label.toLowerCase())) {
         _showDumpTagError('Bu isimde bir etiket zaten var.');
         return;
     }
     if (custom.length >= DUMP_CUSTOM_TAG_MAX) {
         _showDumpTagError(`En fazla ${DUMP_CUSTOM_TAG_MAX} özel etiket eklenebilir.`);
         return;
     }
     const id = 'custom_' + Date.now();
     custom.push({ id, label });
     saveDumpCustomTags(custom);
     _refreshTagManager();
     renderDumpFilterBtns();
 }

 function _showDumpTagError(msg) {
     if (!_dumpTagError) return;
     _dumpTagError.textContent = msg;
     _dumpTagError.style.display = 'block';
     if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,118,117,0.6)';
     setTimeout(() => {
         if (_dumpTagError) _dumpTagError.style.display = 'none';
         if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,255,255,0.1)';
     }, 2800);
 }

 function openAddCustomTagPrompt() {
     if (!_dumpTagMgrModal) return;
     _refreshTagManager();
     _dumpTagMgrModal.classList.remove('hidden');
     setTimeout(() => _dumpTagInput && !_dumpTagInput.disabled && _dumpTagInput.focus(), 80);
 }

 // Karakter sayacı
 if (_dumpTagInput) {
     _dumpTagInput.addEventListener('input', () => {
         const len = _dumpTagInput.value.length;
         if (_dumpTagCharCount) {
             _dumpTagCharCount.textContent = `${len}/16`;
             _dumpTagCharCount.style.color = len >= 14 ? '#fdcb6e' : 'var(--text-muted)';
         }
         if (_dumpTagError) _dumpTagError.style.display = 'none';
         if (_dumpTagInput) _dumpTagInput.style.borderColor = 'rgba(255,255,255,0.1)';
     });
     _dumpTagInput.addEventListener('keydown', e => { if (e.key === 'Enter') _saveDumpCustomTag(); });
 }

 if (_dumpTagSaveBtn) _dumpTagSaveBtn.addEventListener('click', _saveDumpCustomTag);

 if (document.getElementById('close-dump-tag-manager-btn')) {
     document.getElementById('close-dump-tag-manager-btn').addEventListener('click', () => {
         _dumpTagMgrModal && _dumpTagMgrModal.classList.add('hidden');
     });
 }
 if (_dumpTagMgrModal) {
     _dumpTagMgrModal.addEventListener('click', e => { if (e.target === _dumpTagMgrModal) _dumpTagMgrModal.classList.add('hidden'); });
 }

 window.selectDumpInlineTag = function(key) {
     dumpInlineSelectedTag = key;
     renderDumpInlineTagRow();
 };

 function submitInlineDump() {
     if (!dumpInlineTextarea) return;
     const text = dumpInlineTextarea.value.trim();
     if (!text) return;
     if (getMindDumpsRef().length >= MAX_MIND_DUMPS) {
         showPremiumModal({
             title: 'Çöplük Dolu 🗑️',
             message: `Zihin çöplüğü, işlenmeyi bekleyen ${MAX_MIND_DUMPS} fikirle dolu. Buradaki amaç düşünceleri biriktirmek değil, kafanı boşaltıp hızlıca işlemek — yeni bir fikir eklemeden önce birkaçını göreve/hedefe dönüştür ya da artık gerekmeyenleri sil.`,
             type: 'warning'
         });
         return;
     }
     getMindDumpsRef().push({ id: generateId(), text, tag: dumpInlineSelectedTag, timestamp: Date.now() });
     saveMindDumps();
     renderMindDumps();
     if (typeof renderCalMindDump === 'function') renderCalMindDump();
     dumpInlineTextarea.value = '';
     dumpInlineTextarea.focus();
 }

 if (dumpInlineSubmitBtn) dumpInlineSubmitBtn.addEventListener('click', submitInlineDump);
 if (dumpInlineTextarea) {
     dumpInlineTextarea.addEventListener('keydown', (e) => {
         if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInlineDump(); }
     });
     const charCounter = document.getElementById('dump-char-counter');
     const MAX = 140;
     dumpInlineTextarea.addEventListener('input', () => {
         const len = dumpInlineTextarea.value.length;
         if (charCounter) {
             charCounter.textContent = `${len} / ${MAX}`;
             charCounter.classList.toggle('warn',  len >= MAX * 0.8 && len < MAX);
             charCounter.classList.toggle('limit', len >= MAX);
         }
     });
 }

 window.changeDumpTag = function(id, newTag) {
     const dump = getMindDumpsRef().find(d => String(d.id) === String(id));
     if (!dump) return;
     dump.tag = newTag;
     saveMindDumps();
     renderMindDumps();
 };

 window.toggleDumpTagPicker = function(id, badgeEl) {
     // Açık picker varsa kapat
     const existing = document.getElementById('dump-tag-picker');
     if (existing) {
         if (existing.dataset.dumpId === String(id)) { existing.remove(); return; }
         existing.remove();
     }
     const meta = getDumpTagMeta();
     const customTags = getDumpCustomTags();
     const VISIBLE_PRESET = ['ana-hedef', 'aliskanlik', 'fikir', 'diger'];
     const allTags = [...VISIBLE_PRESET, ...customTags.map(t => t.id)];
     const picker = document.createElement('div');
     picker.id = 'dump-tag-picker';
     picker.dataset.dumpId = String(id);
     picker.className = 'dump-tag-picker';
     allTags.forEach(tag => {
         const m = meta[tag] || meta.diger;
         const btn = document.createElement('button');
         btn.className = 'dump-tag-picker-btn';
         btn.textContent = m.label;
         btn.style.color = m.color;
         btn.addEventListener('click', (e) => { e.stopPropagation(); picker.remove(); changeDumpTag(id, tag); });
         picker.appendChild(btn);
     });
     // Özel etiket yönetimi linki
     const mgrBtn = document.createElement('button');
     mgrBtn.className = 'dump-tag-picker-btn dump-tag-picker-mgr';
     mgrBtn.textContent = '+ Özel etiket';
     mgrBtn.addEventListener('click', (e) => { e.stopPropagation(); picker.remove(); openAddCustomTagPrompt(); });
     picker.appendChild(mgrBtn);
     badgeEl.parentElement.appendChild(picker);
     setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
 };

 // Arama
 const dumpSearchInput = document.getElementById('dump-search-input');
 if (dumpSearchInput) {
     dumpSearchInput.addEventListener('input', () => {
         dumpSearchQuery = dumpSearchInput.value.trim();
         renderMindDumps();
     });
 }

 // Filtre butonları dinamik render edilir (renderDumpFilterBtns ile)
 renderDumpFilterBtns();

 // Temizleme hatırlatıcısı dismiss
 const cleanupDismissBtn = document.getElementById('dump-cleanup-dismiss');
 if (cleanupDismissBtn) {
     cleanupDismissBtn.addEventListener('click', () => {
         FocusStorage.set('dump_banner_dismissed_at', Date.now());
         const banner = document.getElementById('dump-cleanup-banner');
         if (banner) banner.style.display = 'none';
     });
 }

 // Eski input fallback (başka yerden çağrılıyorsa diye)
 const dumpInput = document.getElementById('dump-input');
 const addDumpBtn = document.getElementById('add-dump-btn');
 function addMindDump() {
     if(!dumpInput) return;
     const text = dumpInput.value.trim();
     if(!text) return;
     if (getMindDumpsRef().length >= MAX_MIND_DUMPS) {
         showPremiumModal({
             title: 'Çöplük Dolu 🗑️',
             message: `Zihin çöplüğü, işlenmeyi bekleyen ${MAX_MIND_DUMPS} fikirle dolu. Yeni bir fikir eklemeden önce birkaçını göreve/hedefe dönüştür ya da artık gerekmeyenleri sil.`,
             type: 'warning'
         });
         return;
     }
     getMindDumpsRef().push({ id: generateId(), text, timestamp: Date.now() });
     dumpInput.value = '';
     saveMindDumps();
     renderMindDumps();
     if (typeof renderCalMindDump === 'function') renderCalMindDump();
 }
 if(addDumpBtn) addDumpBtn.addEventListener('click', addMindDump);
 if(dumpInput) dumpInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addMindDump(); });

 const dumpInlineTagRowEl = document.getElementById('dump-inline-tag-row');
 if (dumpInlineTagRowEl) {
     dumpInlineTagRowEl.addEventListener('click', (e) => {
         const btn = e.target.closest('[data-action="select-dump-inline-tag"]');
         if (!btn) return;
         window.selectDumpInlineTag(btn.dataset.tag);
     });
 }
 const dumpListEl = document.getElementById('dump-list');
 if (dumpListEl) {
     dumpListEl.addEventListener('click', (e) => {
         const emptyBtn = e.target.closest('[data-action="focus-dump-textarea"]');
         if (emptyBtn) {
             const ta = document.getElementById('dump-inline-textarea');
             if (ta) ta.focus();
             return;
         }
         const actionBtn = e.target.closest('[data-action]');
         if (!actionBtn) return;
         const id = actionBtn.dataset.id;
         const action = actionBtn.dataset.action;
         if (action === 'edit-dump') startDumpEdit(id);
         else if (action === 'convert-dump') openConvertModal(id);
         else if (action === 'delete-dump') deleteMindDump(id);
     });
 }


 window.deleteMindDump = function(id) {
     const idx = getMindDumpsRef().findIndex(d => String(d.id) === String(id));
     if (idx === -1) return;
     const [deleted] = getMindDumpsRef().splice(idx, 1);
     saveMindDumps();
     renderMindDumps();
     showUndoToast(`"${deleted.text.slice(0, 40)}${deleted.text.length > 40 ? '…' : ''}" silindi`, () => {
         getMindDumpsRef().splice(idx, 0, deleted);
         saveMindDumps();
         renderMindDumps();
     });
 }

 window.startDumpEdit = function(id) {
     const li = document.querySelector(`.dump-item[data-dump-id="${id}"]`);
     if (!li) return;
     const titleSpan = li.querySelector('.dump-title');
     if (!titleSpan || li.classList.contains('dump-editing')) return;

     const originalText = titleSpan.textContent;
     li.classList.add('dump-editing');

     const input = document.createElement('input');
     input.type = 'text';
     input.className = 'dump-inline-input';
     input.value = originalText;
     titleSpan.replaceWith(input);
     input.focus();
     input.select();

     // Düzenleme sırasında etiket rozeti tıklanabilir hale gelir
     const tagBadge = li.querySelector('.dump-tag-badge');
     if (tagBadge) {
         tagBadge.classList.add('dump-tag-badge-btn');
         tagBadge.title = 'Etiketi değiştir';
         tagBadge.addEventListener('mousedown', (e) => e.preventDefault());
         tagBadge.addEventListener('click', (e) => {
             e.stopPropagation();
             toggleDumpTagPicker(id, tagBadge);
         });
     }

     function commit() {
         const newText = input.value.trim();
         if (newText && newText !== originalText) {
             const dump = getMindDumpsRef().find(d => String(d.id) === String(id));
             if (dump) { dump.text = newText; saveMindDumps(); }
         }
         renderMindDumps();
     }
     function cancel() { renderMindDumps(); }

     input.addEventListener('blur', commit);
     input.addEventListener('keydown', (e) => {
         if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
         if (e.key === 'Escape') { e.removeEventListener('blur', commit); cancel(); }
     });
 }
