// ── TAM EKRAN DERİN YAZIM MODU ──
// script-journal-library.js dosyasından çıkarıldı: kendi DOM referanslarından
// başka hiçbir şeye (paylaşılan modül state'ine) bağımlı değildi, tamamen
// kendi kendine yeten bir IIFE'ydi.
export function initDeepWriteMode() {
    const overlay  = document.getElementById('deepwrite-modal');
    const textarea = document.getElementById('deepwrite-textarea');
    const charEl   = document.getElementById('deepwrite-char-count');
    const labelEl  = document.getElementById('deepwrite-label');
    const saveBtn  = document.getElementById('deepwrite-save');
    const closeBtn = document.getElementById('deepwrite-close');
    if (!overlay || !textarea) return;

    let _sourceId  = null; // Hangi textarea'dan açıldı

    function updateDeepChar() {
        const len = textarea.value.length;
        charEl.textContent = `${len} / 1000`;
        charEl.classList.remove('cc-writing','cc-good','cc-warn','cc-limit');
        if      (len === 0)       { /* gri */ }
        else if (len < 500)       charEl.classList.add('cc-writing');
        else if (len < 800)       charEl.classList.add('cc-good');
        else if (len < 1000)      charEl.classList.add('cc-warn');
        else                      charEl.classList.add('cc-limit');
    }

    function openDeepWrite(sourceId, label) {
        _sourceId = sourceId;
        const src = document.getElementById(sourceId);
        if (!src) return;
        textarea.value = src.value;
        labelEl.textContent = label;
        updateDeepChar();
        overlay.classList.remove('hidden');
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }

    function closeDeepWrite(save) {
        if (save && _sourceId) {
            const src = document.getElementById(_sourceId);
            if (src) {
                src.value = textarea.value;
                src.dispatchEvent(new Event('input')); // sayacı güncelle
            }
        }
        overlay.classList.add('hidden');
        _sourceId = null;
    }

    textarea.addEventListener('input', updateDeepChar);
    saveBtn?.addEventListener('click', () => closeDeepWrite(true));
    closeBtn?.addEventListener('click', () => closeDeepWrite(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDeepWrite(true); });
    document.addEventListener('keydown', e => {
        if (!overlay.classList.contains('hidden')) {
            if (e.key === 'Escape') { closeDeepWrite(true); e.preventDefault(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { closeDeepWrite(true); e.preventDefault(); }
        }
    });

    // Tüm expand butonlarını bağla
    document.addEventListener('click', e => {
        const btn = e.target.closest('.deepwrite-expand-btn');
        if (!btn) return;
        const targetId = btn.getAttribute('data-target');
        const label = btn.closest('.form-group, div')?.querySelector('label')?.textContent?.trim()
            || (targetId.includes('achieve') ? 'Gurur Duyduklarım' : 'Geliştireceklerim');
        openDeepWrite(targetId, label);
    });
}
