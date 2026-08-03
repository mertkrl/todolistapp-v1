// ─── GRUP ODAK OVERLAY — İLHAM SÖZÜ DÖNGÜSÜ ───────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19). GF_QUOTES,
// gfQuoteIndex, gfQuoteInterval bu 3 fonksiyon dışında hiçbir yerde
// kullanılmıyor — tamamen izole, sadece DOM'a dokunuyor.
const GF_QUOTES = [
    "Başlamak için mükemmel olmak zorunda değilsin, ama mükemmel olmak için başlamak zorundasın.",
    "Zorluklar, başarının süsüdür. Odaklan ve aş.",
    "Odağını nereye verirsen, enerjin oraya akar.",
    "Küçük ve istikrarlı adımlar, en büyük dağları aşırır.",
    "Başarı, her gün tekrarlanan küçük çabaların toplamıdır.",
    "🚀 Küçük adımlar, büyük başarılara götürür.",
    "🔥 Şu an harcadığın her dakika, geleceğine yapılan bir yatırım.",
    "🌱 Disiplin, hedeflerinle hayalin arasındaki köprüdür.",
    "💪 Zorlandığın an, aslında geliştiğin andır.",
    "🎯 Odaklan: yapman gereken tek şey bu an.",
    "⏳ Zaman geçiyor — onu değerli kılan, şu an verdiğin emek.",
    "🌟 Bugün attığın adım, yarının sonucunu belirler.",
    "🤝 Birlikte ilerlemek, motivasyonu ikiye katlar.",
    "✨ Mükemmel olmak zorunda değilsin, sadece devam et.",
    "🧠 Derin odak, en güçlü süper gücündür.",
    "🌤️ Her seans, daha iyi bir versiyonuna bir adım daha.",
    "🏆 Tutarlılık, yetenekten daha güçlüdür."
];
let gfQuoteInterval = null;
let gfQuoteIndex = -1;

export function gfShowNextQuote() {
    const el = document.getElementById('gf-focus-quote');
    if (!el) return;
    let nextIndex;
    do {
        nextIndex = Math.floor(Math.random() * GF_QUOTES.length);
    } while (GF_QUOTES.length > 1 && nextIndex === gfQuoteIndex);
    gfQuoteIndex = nextIndex;
    el.style.opacity = 0;
    setTimeout(() => {
        el.textContent = `"${GF_QUOTES[gfQuoteIndex]}"`;
        el.style.opacity = 1;
    }, 1400);
}
window.gfShowNextQuote = gfShowNextQuote;

export function gfStartQuoteRotation() {
    gfShowNextQuote();
    if (gfQuoteInterval) clearInterval(gfQuoteInterval);
    gfQuoteInterval = setInterval(gfShowNextQuote, 15000);
}
window.gfStartQuoteRotation = gfStartQuoteRotation;

export function gfStopQuoteRotation() {
    if (gfQuoteInterval) { clearInterval(gfQuoteInterval); gfQuoteInterval = null; }
    // Fade animasyonu ortasında durmuş olabilir — opacity'yi geri getir
    const el = document.getElementById('gf-focus-quote');
    if (el) el.style.opacity = 1;
}
window.gfStopQuoteRotation = gfStopQuoteRotation;
