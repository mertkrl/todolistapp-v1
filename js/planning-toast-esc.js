export function esc(s)  {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
window.esc = esc;

export function toast(msg, opts) {
    // opts: { undoFn, undoLabel, duration }
    let el=document.getElementById('pg-toast');
    if (!el) { el=document.createElement('div'); el.id='pg-toast'; el.className='pg-toast'; document.body.appendChild(el); }
    el.innerHTML=''; el.classList.add('show');
    clearTimeout(el._t);
    const span=document.createElement('span'); span.textContent=msg; el.appendChild(span);
    if (opts?.undoFn) {
        const btn=document.createElement('button'); btn.className='pg-toast-undo'; btn.textContent=opts.undoLabel||'Geri Al';
        btn.onclick=()=>{ clearTimeout(el._t); el.classList.remove('show'); opts.undoFn(); };
        el.appendChild(btn);
    }
    el._t=setTimeout(()=>el.classList.remove('show'), opts?.duration||2800);
}
window.toast = toast;
