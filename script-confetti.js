// ─── KONFETİ / MİKRO-EFEKTLER ───────────────────────────────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Paylaşılan state
// (tasks/habits/goals/calendarEvents) dokunmuyor — saf görsel efektler.
// Yükleme sırası önemsiz: script.js'in kendi çağrısı (görev tamamlama
// burst'ü) bir olay işleyicisi içinde, top-level init'te değil.

function microBurst(originX, originY) {
    const COLORS = ['#6c5ce7','#a29bfe','#2ed573','#ff9f43','#feca57','#fd79a8','#74b9ff'];
    const COUNT  = 16;
    for (let i = 0; i < COUNT; i++) {
        const angle    = (i / COUNT) * Math.PI * 2;
        const distance = 38 + Math.random() * 32;
        const size     = 5 + Math.random() * 5;
        const d        = document.createElement('div');
        Object.assign(d.style, {
            position:     'fixed',
            left:         (originX - size / 2) + 'px',
            top:          (originY - size / 2) + 'px',
            width:        size + 'px',
            height:       size + 'px',
            borderRadius: '50%',
            background:   COLORS[i % COLORS.length],
            pointerEvents:'none',
            zIndex:       '999997',
            opacity:      '1',
            transition:   'none',
            willChange:   'transform, opacity',
        });
        document.body.appendChild(d);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                d.style.transition = 'transform 0.55s cubic-bezier(.25,.46,.45,.94), opacity 0.55s ease';
                d.style.transform  = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`;
                d.style.opacity    = '0';
            });
        });
        setTimeout(() => d.remove(), 700);
    }
}
window.microBurst = microBurst;

// Görsel Şölen: Konfeti Animasyonu
function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#2ed573', '#ff9f43', '#ff4757', '#6c5ce7', '#feca57'];

    for(let i=0; i<150; i++) {
        particles.push({
            x: canvas.width / 2, y: canvas.height / 2 + 50,
            r: Math.random() * 6 + 2, dx: Math.random() * 15 - 7.5, dy: Math.random() * -15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10, tiltAngle: 0, tiltAngleInc: (Math.random() * 0.07) + 0.05
        });
    }

    let animationId;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleInc;
            p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.dy += 0.15; p.x += p.dx; p.y += p.dy;

            if(p.y <= canvas.height) active = true;

            ctx.beginPath(); ctx.lineWidth = p.r; ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y); ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
        });
        if(active) animationId = requestAnimationFrame(render);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    render();
    setTimeout(() => cancelAnimationFrame(animationId), 5000); // 5 saniye sonra temizle
}
window.fireConfetti = fireConfetti; // social.js gibi diğer scriptlerden (grup hedefi kutlaması) erişim için
