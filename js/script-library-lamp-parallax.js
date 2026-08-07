// Zihin Kütüphanesi Canlı Odak Işığı (Paralaks) Motoru (script.js'ten çıkarıldı).
export function initLibraryLampParallax() {
    const libraryRoomContainer = document.getElementById('library-room');
    if (!libraryRoomContainer) return;

    // Hedef değerler (ham)
    let targetLampX = 50, targetLampY = 2;
    // Mevcut değerler (lerp ile yumuşatılmış)
    let currentLampX = 50, currentLampY = 2;
    let lampRafId = null;

    function lerpLamp() {
        const speed = 0.07; // 0.07 = yumuşak ağır
        currentLampX += (targetLampX - currentLampX) * speed;
        currentLampY += (targetLampY - currentLampY) * speed;
        libraryRoomContainer.style.setProperty('--lamp-x', `${currentLampX.toFixed(2)}%`);
        libraryRoomContainer.style.setProperty('--lamp-y', `${currentLampY.toFixed(2)}%`);
        // Hedefe yaklaştıysa dur
        if (Math.abs(targetLampX - currentLampX) > 0.05 || Math.abs(targetLampY - currentLampY) > 0.05) {
            lampRafId = requestAnimationFrame(lerpLamp);
        } else {
            lampRafId = null;
        }
    }

    libraryRoomContainer.addEventListener('mousemove', (e) => {
        const rect = libraryRoomContainer.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
        // Işık hareketi: X geniş (30-70), Y dar (0-8)
        targetLampX = 30 + xPct * 0.40;
        targetLampY = yPct * 0.08;
        if (!lampRafId) lampRafId = requestAnimationFrame(lerpLamp);
    });

    libraryRoomContainer.addEventListener('mouseleave', () => {
        targetLampX = 50;
        targetLampY = 2;
        if (!lampRafId) lampRafId = requestAnimationFrame(lerpLamp);
    });
}
