#!/usr/bin/env bash
# sw.js'teki CACHE sabitini, önbelleğe alınan dosyaların İÇERİĞİNDEN
# hesaplanan bir hash ile otomatik günceller. Böylece versiyon numarası
# artık "geliştiricinin hatırlaması"na değil dosya içeriğine bağlı olur —
# bir dosya değişmediyse hash de değişmez, gereksiz cache invalidation
# olmaz; herhangi bir dosya değiştiyse hash otomatik değişir.
#
# Kurulum gerektirmez (shasum/sha256sum sistemde hazır gelir).
#
# Kullanım: her deploy öncesi çalıştırın:
#   ./scripts/update-sw-version.sh

set -euo pipefail
cd "$(dirname "$0")/.."

SW_FILE="sw.js"
[ -f "$SW_FILE" ] || { echo "sw.js bulunamadı" >&2; exit 1; }

# sw.js'teki FILES dizisinden dosya adlarını çıkar (./ ve yorum satırlarını atla)
PRECACHE_FILES=$(sed -n "/const FILES = \[/,/\];/p" "$SW_FILE" \
    | grep -oE "'\./[^']+'" \
    | tr -d "'" \
    | sed 's#^\./##' \
    | grep -v '^$')

if command -v shasum >/dev/null 2>&1; then
    HASHER="shasum -a 256"
else
    HASHER="sha256sum"
fi

COMBINED=""
while IFS= read -r f; do
    [ -f "$f" ] || continue
    COMBINED+=$($HASHER "$f" | awk '{print $1}')
done <<< "$PRECACHE_FILES"

if [ -z "$COMBINED" ]; then
    echo "Hiç dosya bulunamadı, hash hesaplanamadı." >&2
    exit 1
fi

HASH=$(printf '%s' "$COMBINED" | $HASHER | awk '{print $1}' | cut -c1-10)
NEW_CACHE="focusai-$HASH"

CURRENT=$(grep -oE "const CACHE = '[^']+'" "$SW_FILE" | sed "s/const CACHE = '//; s/'//")

# public/sw.js — Vite'ın "public/" klasörü build sırasında dist/'e olduğu
# gibi kopyalanıyor, gerçek üretim çıktısında kullanılan sw.js BUDUR (bkz.
# scripts/update-sw-file-list.py'deki not). Kök sw.js değişmemiş olsa bile
# public/sw.js geride kalmış olabilir (ör. FILES listesi az önce
# update-sw-file-list.py ile güncellendi ama versiyon script'i daha
# çalışmadıysa) — bu yüzden bu bloğu ERKEN ÇIKIŞTAN ÖNCE çalıştırıyoruz.
PUBLIC_SW="public/sw.js"
if [ -f "$PUBLIC_SW" ]; then
    PUBLIC_CURRENT=$(grep -oE "const CACHE = '[^']+'" "$PUBLIC_SW" | sed "s/const CACHE = '//; s/'//")
    if [ "$PUBLIC_CURRENT" != "$NEW_CACHE" ]; then
        sed -i.bak "s/const CACHE = '[^']*'/const CACHE = '$NEW_CACHE'/" "$PUBLIC_SW"
        rm -f "$PUBLIC_SW.bak"
        echo "✓ public/sw.js cache versiyonu güncellendi: $PUBLIC_CURRENT → $NEW_CACHE"
    fi
fi

if [ "$CURRENT" = "$NEW_CACHE" ]; then
    echo "✓ Değişiklik yok — sw.js cache versiyonu zaten güncel: $CURRENT"
    exit 0
fi

sed -i.bak "s/const CACHE = '[^']*'/const CACHE = '$NEW_CACHE'/" "$SW_FILE"
rm -f "$SW_FILE.bak"

echo "✓ sw.js cache versiyonu güncellendi: $CURRENT → $NEW_CACHE"
