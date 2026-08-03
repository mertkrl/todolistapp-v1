// Sekme geçiş çekirdeği (Faz H2, script.js'ten çıkarıldı).
// - _switchTabRender/switchTab script.js'in closure-scoped tasks/calendarEvents
//   değişkenlerini yeniden atadığı için window.__getTasksRef/__setTasksRef ve
//   window.__getCalendarEventsRef/__setCalendarEventsRef köprüleri kullanılıyor.
// - renderStatisticsRef/renderJournalRef/renderMindDumpsRef/renderSocialStatsRef/
//   renderBuddyHabitsRef script.js'te closure-scoped function-pointer'lar —
//   window.__getRender*Ref() köprüleriyle okunuyor.
// - renderGoals/buildCalendarView/renderPlanningRef/renderJournalRef vb. zaten
//   script.js'te de bare çağrılıp global (window.*) fallback'e düşen isimlerdi;
//   burada doğrudan window.* olarak çağrılıyor.
import { getDcRestorePending } from './state/dc-restore-pending-store.js';
// renderLeaderboardFromCache/resyncRecentConversationsAndUnread bilinçli olarak
// window.* üzerinden çağrılıyor (statik import değil) — bu dosya index.html'de
// eagerly yüklendiği için social-friends/dm-notifications.js'i main bundle'a
// çekmesin diye (Faz Q, ana bundle küçültme).

function _switchTabRender(targetId) {
    if (targetId === 'bugun') {
        window.renderTasks();
        // 5.4 — Sprint widget güncelle
        if (typeof window.renderTodaySprintWidget === 'function')
            setTimeout(window.renderTodaySprintWidget, 200);
        // Sınıf ödevleri (social.js window.FocusAssignments) her sekme açılışında
        // taze çekilsin — sadece login anındaki/bildirimdeki önbelleğe güvenmeyelim,
        // öğretmen ödev eklediğinde öğrenci sayfayı yenilemeden de görsün.
        if (window.FocusAssignments && typeof window.FocusAssignments.refresh === 'function') {
            window.FocusAssignments.refresh();
        }
    }

    const renderStatisticsRef = window.__getRenderStatisticsRef();
    if (targetId === 'istatistikler' && typeof renderStatisticsRef === 'function') {
        renderStatisticsRef();
    }
    if (targetId === 'istatistikler' && typeof window.renderPlanningStats === 'function') {
        setTimeout(window.renderPlanningStats, 100);
    }

    if (targetId === 'hedefler' && typeof window.renderGoals === 'function') {
        window.renderGoals();
    }

    const renderJournalRef = window.__getRenderJournalRef();
    if (targetId === 'gunluk' && typeof renderJournalRef === 'function') {
        // Sekmeye dönüşte, o an hangi görünüm (raf/takvim) aktifse onu yeniden çiz.
        // Aksi halde raf görünümü takvim aktifken (gizliyken, offsetWidth=0) yeniden
        // hesaplanır ve yanlış (fallback) genişlikle bozuk render edilir.
        const calView = document.getElementById('library-calendar-view');
        if (calView && !calView.classList.contains('hidden')) {
            if (typeof window.buildCalendarView === 'function') window.buildCalendarView();
        } else {
            renderJournalRef();
        }
    }

    const renderMindDumpsRef = window.__getRenderMindDumpsRef();
    if (targetId === 'zihin-coplugu' && typeof renderMindDumpsRef === 'function') {
        renderMindDumpsRef();
    }

    if (targetId === 'arkadaslar') {
        const renderSocialStatsRef = window.__getRenderSocialStatsRef();
        const renderBuddyHabitsRef = window.__getRenderBuddyHabitsRef();
        if (typeof renderSocialStatsRef === 'function') renderSocialStatsRef();
        if (typeof renderBuddyHabitsRef === 'function') renderBuddyHabitsRef();
        if (typeof window.simulateIncomingInvite === 'function') window.simulateIncomingInvite();
        // Başka bir sekmedeyken kaçırılmış olabilecek DM/okunmamış güncellemelerini telafi et
        if (typeof window.resyncRecentConversationsAndUnread === 'function') window.resyncRecentConversationsAndUnread();
        // Arena varsayılan: sosyal bölüme her girişte rekabet panosu açılır.
        // İSTİSNA: sayfa yenileme restorasyonu (social.js _dcRestoreLastOpenOnLoad)
        // kullanıcının kaldığı grup panelini/sohbeti geri açacaksa Arena'yı zorlama —
        // bu çağrı DOMContentLoaded (isTrusted) içinden geldiği için dcSetMainView'ın
        // kendi "otomatik çağrı" koruması onu kullanıcı tıklaması sanıyordu.
        if (typeof window.dcSetMainView === 'function' && !getDcRestorePending()) window.dcSetMainView('home');
        if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        if (typeof window.renderLeaderboardFromCache === 'function') window.renderLeaderboardFromCache();
    }

    if (targetId === 'planlama') {
        if (typeof window.renderPlanningRef === 'function') window.renderPlanningRef();
    } else {
        // Planlama'dan başka bir sekmeye geçilirken açık kalan Hedef Detay/Plan
        // Görünümü (tam ekran overlay) kapatılmazsa localStorage'daki
        // 'pg_pv_last_goal' kaydı silinmiyor — sayfa başka bir sekmede
        // (ör. takvim) yenilendiğinde planning.js init() bu kaydı görüp
        // overlay'i sekmeden bağımsız olarak tekrar açıyor, kullanıcıya
        // sanki sayfa hep Planlama'da açılmış gibi görünüyordu.
        if (typeof window.closePlanView === 'function') {
            const pv = document.getElementById('pg-plan-view');
            if (pv && !pv.classList.contains('hidden')) window.closePlanView();
        }
    }

    // Takvim sekmesine geçildiğinde storage'dan taze oku ve çiz
    if (targetId === 'takvim') {
        window.__setTasksRef(Store.tasks.get());
        window.__setCalendarEventsRef(Store.events.get());
        if (typeof window.switchCalView === 'function') {
            window.switchCalView(window.__getCurrentCalView() || 'monthly');
        }
        // Sınıf ödevleri de taze çekilsin (bkz. 'bugun' dalındaki aynı not)
        if (window.FocusAssignments && typeof window.FocusAssignments.refresh === 'function') {
            window.FocusAssignments.refresh();
        }
    }
}

export function switchTab(targetId) {
    const navLinks = document.querySelectorAll('.nav-links li');
    const pageSections = document.querySelectorAll('.page-section');

    // Sosyal sekmesinden başka bir sekmeye geçiliyorsa açık kalan sohbeti kapat.
    // Aksi halde getActiveChatTarget() sekmeler arası geçişten sonra da o kişiyle
    // yazışılıyormuş gibi kalıyor ve gelen yeni mesajlar sessizce "okundu" işaretlenip
    // Son Mesajlaşmalar'da hiç okunmamış rozeti çıkmıyordu (sayfa yenilenince düzeliyordu,
    // çünkü _activeChatTarget o zaman null'a resetleniyordu).
    if (targetId !== 'arkadaslar' && typeof window.closeDcChat === 'function') {
        window.closeDcChat();
    }

    // Track active tab on body for CSS visibility rules
    document.body.setAttribute('data-active-tab', targetId);

    // Zamanlayıcı sekmesinden ayrılınca Hayalet Mod'u hemen kapat — aksi halde
    // zamanlayıcı çalışırken başka bir sekmede (örn. Sosyal) birkaç saniye
    // hareketsiz kalındığında o sekmedeki .section-header (sıralama/seri listesi
    // başlığı gibi) yanlışlıkla soluk kalmaya devam edebiliyordu.
    if (targetId !== 'zamanlayici') {
        document.body.classList.remove('ghost-mode-active');
    }

    navLinks.forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-target') === targetId) {
            nav.classList.add('active');
        }
    });

    // Dock aktif durumunu doğrudan güncelle (MutationObserver köprüsüne gerek yok)
    document.querySelectorAll('#app-dock .di[data-target]').forEach(function(d) {
        d.classList.toggle('act', d.getAttribute('data-target') === targetId);
    });

    pageSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
            section.classList.add('active');
        }
    });

    // Aktif sekmeyi hemen kaydet — DOM zaten doğru sekmeyi gösteriyor. Bundan
    // SONRAKİ sekmeye özel render çağrılarından biri (renderGoals, switchCalView
    // vb.) hata fırlatırsa fonksiyonun geri kalanı çalışmadan kesiliyordu; kayıt
    // en sonda olduğu için o zaman hiç yazılmıyordu — sekme görsel olarak
    // değişmiş gibi görünse de sayfa yenilenince eski sekmeye geri dönüyordu
    // (bkz. kullanıcı geri bildirimi: sekmeler arası geçiş sonrası yenilemede
    // yanlış sekmeye dönme). Artık kayıt, aşağıdaki render çağrılarının
    // başarısından bağımsız.
    // NOT: 'zamanlayici' eskiden hariç tutuluyordu (sayfa yenilemede odak
    // seansı sıfırlandığı için kafa karıştırıcı olabileceği düşünülmüştü),
    // ama kullanıcı hangi sekmeden Zamanlayıcı'ya geçerse geçsin yenilemede
    // Zamanlayıcı'da kalmasını istiyor — artık diğer sekmeler gibi kaydediliyor.
    if (!window._restoringTab) {
        FocusStorage.set('lastActiveTab', targetId);
    }

    try {
        _switchTabRender(targetId);
    } catch (e) {
        // Sekmeye özel render çağrılarından biri hata fırlatırsa (ör. bozuk/eksik
        // alanlı bir hedef verisi renderGoals'u çökertirse) sekme geçişi tamamen
        // sessizce yarım kalmasın — en azından DOM/kayıt zaten yukarıda tamamlandı,
        // burada sadece loglayıp devam ediyoruz.
        console.error(`[switchTab] "${targetId}" sekmesi render edilirken hata:`, e);
    }
}
window.switchTab = switchTab; // dock ve diğer global çağrılar için
