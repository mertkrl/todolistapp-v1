// Kalan bekleme süresini (ms) kullanıcıya gösterilecek okunabilir bir metne çevirir
export function formatCooldownRemaining(ms) {
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} saat ${minutes} dakika`;
    if (hours > 0) return `${hours} saat`;
    return `${minutes} dakika`;
}
