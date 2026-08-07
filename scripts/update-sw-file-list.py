#!/usr/bin/env python3
# sw.js'teki FILES (önbelleğe alınacak dosya) dizisini kök dizindeki TÜM
# .js/.css dosyalarından otomatik üretir.
#
# NEDEN: FILES listesi elle yazılmıştı ve sadece 9 dosya içeriyordu — ama
# modülerleştirme serileri (Faz C/F/G) boyunca style.css/script.js/social.js
# gibi tek dosyalar 200'den fazla küçük modüle bölündü. Elle tutulan liste
# bunları hiç görmedi, yani ilk-yükleme/offline önbellek çoğu dosyayı
# kapsamıyordu. Bu script her çalıştığında kök dizini tarar, listeyi
# yeniden üretir — kimsenin yeni bir dosya eklerken hatırlayıp elle
# FILES'a eklemesi gerekmez.
#
# Kurulum GEREKTİRMEZ — sadece Python'un standart kütüphanesini kullanır
# (bu repo zaten scripts/check-innerhtml.py için python3 kullanıyor).
#
# Kullanım (deploy öncesi, update-sw-version.sh'den ÖNCE):
#   python3 scripts/update-sw-file-list.py && ./scripts/update-sw-version.sh
#
# Bu script CACHE sabitine (hash'e) DOKUNMAZ — onu update-sw-version.sh
# yönetiyor, ikisi birlikte çalışır: önce dosya listesi güncellenir, sonra
# o listenin içeriğinden hash hesaplanıp cache adı bumplanır.

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SW_FILE = ROOT / "sw.js"
# Vite'ın "public/" klasörü build sırasında dist/'e OLDUĞU GİBİ kopyalanıyor
# ve gerçek üretim çıktısında kullanılan sw.js BUDUR (bkz. Faz M notu) — kök
# dizindeki sw.js sadece `npm run dev` sırasında kullanılıyor. İkisi de
# senkron tutulmazsa tam da bu script'in çözmeye çalıştığı sorun (bayat
# precache listesi) production'da aynen devam eder.
SW_FILE_PUBLIC = ROOT / "public" / "sw.js"

# Kök dizinde olup service worker'ın önbelleğe ALMAMASI gereken dosyalar:
# sw.js'in kendisi ve build/tooling config'i — bunlar "uygulama kabuğu"
# (kullanıcının tarayıcıda çalıştırdığı kod) değil.
EXCLUDE_NAMES = {"sw.js", "vite.config.js"}


def collect_files():
    files = []
    # Kök dizindeki "uygulama kabuğu" dosyaları (public/ ile eşlenen inline-*.js'ler)
    # + js/ klasöründeki ES modülleri + css/ klasöründeki stil dosyaları.
    for p in ROOT.glob("*.js"):  # non-recursive: sadece kök dizin
        if p.name in EXCLUDE_NAMES:
            continue
        files.append(p.name)
    for p in (ROOT / "js").glob("*.js"):
        files.append(f"js/{p.name}")
    for p in (ROOT / "css").glob("*.css"):
        files.append(f"css/{p.name}")
    return sorted(files)


def update_one(sw_path, new_block, entry_count):
    if not sw_path.exists():
        print(f"{sw_path} bulunamadı — atlanıyor", file=sys.stderr)
        return

    content = sw_path.read_text(encoding="utf-8")
    pattern = re.compile(r"const FILES = \[.*?\];", re.DOTALL)
    if not pattern.search(content):
        print(f"{sw_path} içinde 'const FILES = [...]' bloğu bulunamadı — dosya formatı değişmiş olabilir.", file=sys.stderr)
        return

    new_content = pattern.sub(lambda _m: new_block.replace("\\", "\\\\"), content, count=1)

    if new_content == content:
        print(f"✓ {sw_path.relative_to(ROOT)}: değişiklik yok, zaten güncel ({entry_count} dosya).")
        return

    sw_path.write_text(new_content, encoding="utf-8")
    print(f"✓ {sw_path.relative_to(ROOT)}: FILES listesi güncellendi ({entry_count} dosya).")


def main():
    files = collect_files()
    entries = ["./", "./index.html"] + [f"./{f}" for f in files]
    array_lines = ",\n".join(f"  '{e}'" for e in entries)
    new_block = f"const FILES = [\n{array_lines}\n];"

    found_any = False
    for sw_path in (SW_FILE, SW_FILE_PUBLIC):
        if sw_path.exists():
            found_any = True
            update_one(sw_path, new_block, len(entries))

    if not found_any:
        print("Ne sw.js ne de public/sw.js bulunamadı", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
