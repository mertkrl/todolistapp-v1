#!/usr/bin/env python3
# `window.foo = ...` aynı isimle BİRDEN FAZLA dosyada atanıyorsa uyarır.
#
# NEDEN: ES modülleri kendi scope'unda izole olduğu için AYNI isimli yerel
# fonksiyon/const 2+ dosyada tanımlanması normalde sorun değil (gerçek bir
# çakışma yaratmaz). Ama `window.foo = ...` GLOBAL bir slottur — iki farklı
# dosya aynı isme FARKLI şeyler atarsa, hangisinin kazanacağı script YÜKLEME
# SIRASINA bağlı hale gelir (sessiz, ortama göre değişen bug riski).
#
# Bu script Faz P6 sırasında social.js'te GERÇEK bir örneğini buldu: bir
# fonksiyon başka bir dosyaya taşınmış ama eski dosyada aynı isimle FAZLADAN
# bir `window.X = X` satırı kalmıştı (aynı referans olduğu için zararsızdı,
# ama yine de gereksiz/yanıltıcıydı — temizlendi).
#
# Bazı çakışmalar BİLİNÇLİ (ör. bir dosyanın diğerinin fonksiyonunu
# monkey-patch etmesi) — bunlar scripts/window-bridge-known-duplicates.txt'te
# beyaz listelenir, script'i KIRMAZLAR.
#
# Kurulum GEREKTİRMEZ — sadece Python standart kütüphanesi.
#
# Kullanım:
#   python3 scripts/check-duplicate-window-bridges.py

import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KNOWN_FILE = ROOT / "scripts" / "window-bridge-known-duplicates.txt"
BRIDGE_RE = re.compile(r"window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)")


def load_known():
    if not KNOWN_FILE.exists():
        return set()
    known = set()
    for line in KNOWN_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            known.add(line)
    return known


def main():
    known = load_known()
    by_name = defaultdict(set)
    for p in sorted(ROOT.glob("*.js")):
        try:
            text = p.read_text(encoding="utf-8")
        except OSError:
            continue
        for name in BRIDGE_RE.findall(text):
            by_name[name].add(p.name)

    unexpected = {n: fs for n, fs in by_name.items() if len(fs) > 1 and n not in known}

    if unexpected:
        print("YENİ/beklenmeyen window.foo çakışması (birden fazla dosya aynı ismi atıyor):", file=sys.stderr)
        for n in sorted(unexpected):
            print(f"  window.{n} ← {', '.join(sorted(unexpected[n]))}", file=sys.stderr)
        print(
            "\nBu bilinçliyse (ör. monkey-patch): ismi scripts/window-bridge-known-duplicates.txt'e ekleyin.\n"
            "Değilse: fonksiyonlardan birini gerçek import'a çevirip fazladan atamayı silin.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"✓ Beklenmeyen window.foo çakışması yok ({len(known)} bilinen istisna hariç).")


if __name__ == "__main__":
    main()
