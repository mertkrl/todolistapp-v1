// --- GELİŞMİŞ AKILLI METİN ALGILAMA (NLP) MOTORU → script.js'ten taşındı ---
import { formatDateToString } from './script-date-time-utils.js';

export function parseSmartText(text) {
    let parsedDate = null;
    let parsedTime = null;
    let cleanText = text;

    // 1. Tam saat formatı tespiti (Örn: 14:30, 14.30)
    const timeRegex = /([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])/i;
    const timeMatch = cleanText.match(timeRegex);

    // 2. "Saat X" formatı tespiti (Örn: saat 2, saat 14)
    const altTimeRegex = /saat\s([0-1]?[0-9]|2[0-3])/i;
    const altTimeMatch = cleanText.match(altTimeRegex);

    // 3. Kesme işareti ile saat tespiti (Örn: 2'ye, 3'te, 14'e, 5'de)
    const suffixTimeRegex = /\b([0-1]?[0-9]|2[0-3])'(ye|ya|te|ta|de|da|e|a)\b/i;
    const suffixTimeMatch = cleanText.match(suffixTimeRegex);

    if (timeMatch) {
        parsedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        // "saat 14:00" gibi HH:MM'den hemen önce gelen "saat" kelimesini de
        // birlikte temizle — aksi halde başlıkta "saat Toplantı" gibi bir
        // artık kelime kalıyordu (timeRegex sadece "14:00"ü kapsıyor).
        cleanText = cleanText.replace(new RegExp('saat\\s+' + timeMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
        cleanText = cleanText.replace(timeMatch[0], '').trim();
    } else if (altTimeMatch) {
        parsedTime = `${altTimeMatch[1].padStart(2, '0')}:00`;
        cleanText = cleanText.replace(altTimeMatch[0], '').trim();
    } else if (suffixTimeMatch) {
        parsedTime = `${suffixTimeMatch[1].padStart(2, '0')}:00`;
        cleanText = cleanText.replace(suffixTimeMatch[0], '').trim();
    }

    // Gün tespiti
    const lowerText = cleanText.toLowerCase();
    let targetDate = new Date();
    let dateFound = false;

    if (lowerText.includes('yarın')) {
        targetDate.setDate(targetDate.getDate() + 1);
        cleanText = cleanText.replace(/yarın/i, '').trim();
        dateFound = true;
    } else if (lowerText.includes('haftaya')) {
        targetDate.setDate(targetDate.getDate() + 7);
        cleanText = cleanText.replace(/haftaya/i, '').trim();
        dateFound = true;
    } else if (lowerText.includes('bugün')) {
        cleanText = cleanText.replace(/bugün/i, '').trim();
        dateFound = true;
    }

    if(dateFound) {
        parsedDate = formatDateToString(targetDate);
    }

    // Fazla kelimeleri ve boşlukları temizle
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return { cleanText, parsedDate, parsedTime };
}
window.parseSmartText = parseSmartText;
