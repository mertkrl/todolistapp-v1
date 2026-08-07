// social-shared-focus-overlay.js dosyasından çıkarıldı — sadece kendi
// state store getter'larından okuyup saf bir obje döndürür, DOM'a veya
// overlay açma/kapama akışının modül-seviyesi state'ine dokunmaz.
import { getCurrentUser } from '../state/current-user-store.js';
import { getScwTimeLeft } from '../state/scw-timer-store.js';
import { getSharedFocusMyTaskId, getSharedFocusMyTaskText } from '../state/shared-focus-my-task-store.js';
import { getSharedFocusBreakMinutes } from '../state/shared-focus-break-minutes-store.js';
import { getSharedFocusSession } from '../state/shared-focus-session-store.js';
import { SHARED_FOCUS_DEFAULT_BREAK_MINUTES } from './social-shared-focus-math.js';

// Bireysel (oda dışı) odaklanma seansı için "Birlikte Çalışalım" arayüzüyle birebir aynı
// görünümdeki tam ekranı besleyecek sahte bir "oda" nesnesi üretir — partner alanları boş kalır,
// bu sayede renderSharedFocusParticipants/applySharedFocusPhase/renderSharedFocusTaskStatus
// hiçbir özel dallanmaya gerek kalmadan aynı şekilde çalışır.
export function buildSoloFocusRoomLike() {
    return {
        hostName: getCurrentUser()?.displayName || 'Sen',
        guestName: null,
        hostTask: getSharedFocusMyTaskId() ? { id: getSharedFocusMyTaskId(), text: getSharedFocusMyTaskText() } : null,
        guestTask: null,
        startedAt: getSharedFocusSession() ? getSharedFocusSession().startedAt : null,
        paused: getSharedFocusSession() ? !!getSharedFocusSession().paused : false,
        pausedAt: getSharedFocusSession() ? getSharedFocusSession().pausedAt : null,
        focusMinutes: getSharedFocusSession() ? getSharedFocusSession().focusMinutes : (Math.round(getScwTimeLeft() / 60) || 25),
        breakMinutes: getSharedFocusSession() ? getSharedFocusSession().breakMinutes : (getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES)
    };
}
