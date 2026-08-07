// social-chat-extras-file-upload.js
// social-chat-extras.js'ten çıkarıldı: dosya paylaşımı (yükleme/render/buton).
// window.FocusChat.* üzerine ekleniyor, dış bağımlılıklar window.FocusSupabase/dcShowToast/escapeHtml.

window.FocusChat = window.FocusChat || {};

window.FocusChat.uploadChatFile = async function(file, scopeType, scopeId) {
    if (!window.FocusSupabase) return null;
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
        window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.');
        return null;
    }
    const ext  = file.name.split('.').pop() || 'bin';
    const path = `${scopeType}/${scopeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await window.FocusSupabase.storage
        .from('chat-files')
        .upload(path, file, { upsert: false });
    if (error) {
        console.error('[ChatFile] Upload hatası:', error.message);
        return null;
    }
    const { data: signed } = await window.FocusSupabase.storage
        .from('chat-files')
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 gün geçerli
    return {
        url: signed?.signedUrl || null,
        name: file.name,
        size: file.size,
        type: file.type,
        bucket_path: data.path
    };
};

window.FocusChat.renderAttachment = function(att) {
    if (!att || !att.url) return null;
    const isImage = att.type && att.type.startsWith('image/');
    const isPdf   = att.type === 'application/pdf';
    const sizeMB  = att.size ? (att.size / (1024 * 1024)).toFixed(1) + ' MB' : '';

    const wrap = document.createElement('div');
    wrap.className = 'dc-msg-attachment';
    wrap.style.marginTop = '6px';
    wrap.style.maxWidth = '260px';

    if (isImage) {
        const img = document.createElement('img');
        img.src = att.url;
        img.alt = att.name || 'Resim';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '220px';
        img.style.borderRadius = '8px';
        img.style.display = 'block';
        img.style.cursor = 'pointer';
        img.style.objectFit = 'cover';
        img.addEventListener('click', () => window.open(att.url, '_blank', 'noopener,noreferrer'));
        wrap.appendChild(img);
    } else {
        const icon = isPdf ? 'fa-file-pdf' : 'fa-file';
        wrap.style.background = 'rgba(255,255,255,0.06)';
        wrap.style.border = '1px solid rgba(255,255,255,0.1)';
        wrap.style.borderRadius = '8px';
        wrap.style.padding = '8px 12px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';
        wrap.style.cursor = 'pointer';
        wrap.innerHTML = `
            <i class="fa-solid ${icon} u-font-size-22px_color-ha29bfe_flex-shrink-0" ></i>
            <div class="u-overflow-hidden">
                <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${window.escapeHtml(att.name || 'Dosya')}</div>
                ${sizeMB ? `<div class="u-font-size-10px_color-rgba2552552550p4">${sizeMB}</div>` : ''}
            </div>
            <i class="fa-solid fa-download u-margin-left-auto_color-rgba2552552550p35_flex-shrink-0" ></i>
        `;
        wrap.addEventListener('click', () => window.open(att.url, '_blank', 'noopener,noreferrer'));
    }
    return wrap;
};

window.FocusChat.initFileUploadBtn = function(inputBarEl, onFileSelected) {
    if (!inputBarEl || inputBarEl.dataset.fileUploadBound) return;
    inputBarEl.dataset.fileUploadBound = '1';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
    fileInput.style.display = 'none';
    fileInput.multiple = false;
    inputBarEl.appendChild(fileInput);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dc-msg-action-btn dc-file-upload-btn';
    btn.title = 'Dosya ekle';
    btn.style.flexShrink = '0';
    btn.style.opacity = '0.6';
    btn.style.transition = 'opacity 0.15s';
    btn.innerHTML = '<i class="fa-solid fa-paperclip"></i>';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.6'; });
    btn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file && typeof onFileSelected === 'function') onFileSelected(file);
        fileInput.value = '';
    });

    const textarea = inputBarEl.querySelector('textarea, input[type=text]');
    if (textarea && textarea.parentNode) {
        textarea.parentNode.insertBefore(btn, textarea);
    } else {
        inputBarEl.prepend(btn);
    }
    return btn;
};
