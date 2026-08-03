#!/usr/bin/env python3
# dist/sw.js'teki FILES listesini GERÇEK build çıktısından üretir (postbuild).
#
# NEDEN: scripts/update-sw-file-list.py FILES listesini KAYNAK dosya
# adlarından (./script.js, ./social.js, ...) üretiyor — bu, `npm run dev`
# için doğru çünkü dev modda dosyalar olduğu gibi sunuluyor. Ama
# `npm run build` sonrası dist/ çıktısında Vite çoğu modülü
# hash'li dosya adlarına (ör. ./assets/social-6VRLS-rI.js) taşıyor;
# kaynak adları dist/'te YOK. Precache install adımı bu yüzden üretimde
# her dosya için 404 alıp (Faz L'nin fetch+put per-file hata toleransı
# sayesinde patlamıyor ama) SESSİZCE hiçbir şeyi önbelleğe almıyordu —
# yani offline/hızlı-yükleme faydası üretimde fiilen sıfırdı.
#
# Bu script dist/index.html'i ve dist/ ağacını TARAYARAK gerçekte var olan
# dosyaları FILES listesine yazar; kaynak adlarına dayanmaz, bu yüzden
# Vite'ın hash'leme/chunklama davranışı değişse bile doğru kalır.
#
# Kurulum GEREKTİRMEZ — sadece Python standart kütüphanesi.
#
# Kullanım (build sonrası, otomatik — package.json "postbuild"):
#   npm run build   # prebuild -> vite build -> postbuild (bu script)

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SW_FILE = DIST / "sw.js"

# dist/ kökünde olup önbelleğe ALINMAMASI gereken dosyalar.
EXCLUDE_NAMES = {"sw.js"}


def local_refs_from_html(html_path: Path):
    """index.html içindeki src=/href= değerlerinden yerel (http olmayan,
    external CDN olmayan) referansları çıkarır."""
    text = html_path.read_text(encoding="utf-8")
    refs = set()
    for m in re.finditer(r'(?:src|href)="([^"]+)"', text):
        ref = m.group(1)
        if ref.startswith("http://") or ref.startswith("https://") or ref.startswith("//"):
            continue
        if ref.startswith("data:"):
            continue
        ref = ref.split("?", 1)[0].split("#", 1)[0]
        ref = ref.lstrip("./")
        if ref and ref not in EXCLUDE_NAMES:
            refs.add(ref)
    return refs


def collect_dist_files():
    if not DIST.exists():
        print(f"{DIST} bulunamadı — önce 'npm run build' çalıştırılmalı.", file=sys.stderr)
        sys.exit(1)

    files = set()

    index_html = DIST / "index.html"
    if index_html.exists():
        files |= local_refs_from_html(index_html)
        files.add("index.html")

    # dist/assets/* içindeki HER dosya (hash'li JS/CSS/SVG/JSON chunk'ları,
    # index.html'de doğrudan referans edilmeyen dinamik import() chunk'ları
    # dahil) — bunlar zaten üretim çalışma zamanının bir parçası.
    assets_dir = DIST / "assets"
    if assets_dir.exists():
        for p in assets_dir.rglob("*"):
            if p.is_file():
                files.add(str(p.relative_to(DIST)).replace("\\", "/"))

    # dist kökündeki inline-*.js dosyaları (public/ klasöründen olduğu gibi
    # kopyalanıyor, index.html'de zaten referans ediliyor olsa da emin olmak
    # için ayrıca tara).
    for p in DIST.glob("inline-*.js"):
        files.add(p.name)

    # Sadece gerçekten var olan dosyaları tut (harici URL/anchor kalıntısı vb. elenir).
    existing = set()
    for f in files:
        if f in EXCLUDE_NAMES:
            continue
        if (DIST / f).is_file():
            existing.add(f)

    return sorted(existing)


def build_sw_content(files):
    entries = ["./", "./index.html"] + [f"./{f}" for f in files if f != "index.html"]
    array_lines = ",\n".join(f"  '{e}'" for e in entries)
    return f"const FILES = [\n{array_lines}\n];"


def compute_cache_hash(files):
    hasher = hashlib.sha256()
    for f in files:
        p = DIST / f
        try:
            hasher.update(p.read_bytes())
        except OSError:
            continue
    return hasher.hexdigest()[:10]


def main():
    if not SW_FILE.exists():
        print(f"{SW_FILE} bulunamadı — dist/sw.js olmadan devam edilemiyor (public/sw.js build'e kopyalanmış olmalı).", file=sys.stderr)
        sys.exit(1)

    files = collect_dist_files()
    if not files:
        print("dist/ içinde önbelleğe alınacak dosya bulunamadı.", file=sys.stderr)
        sys.exit(1)

    new_block = build_sw_content(files)
    new_cache = f"focusai-{compute_cache_hash(files)}"

    content = SW_FILE.read_text(encoding="utf-8")

    files_pattern = re.compile(r"const FILES = \[.*?\];", re.DOTALL)
    if not files_pattern.search(content):
        print(f"{SW_FILE} içinde 'const FILES = [...]' bloğu bulunamadı.", file=sys.stderr)
        sys.exit(1)
    content = files_pattern.sub(lambda _m: new_block.replace("\\", "\\\\"), content, count=1)

    cache_pattern = re.compile(r"const CACHE = '[^']*'")
    if cache_pattern.search(content):
        content = cache_pattern.sub(f"const CACHE = '{new_cache}'", content, count=1)

    SW_FILE.write_text(content, encoding="utf-8")
    print(f"✓ dist/sw.js: FILES listesi gerçek build çıktısından üretildi ({len(files)} dosya), CACHE = '{new_cache}'.")


if __name__ == "__main__":
    main()
