#!/usr/bin/env python3
# `window.foo = foo;` köprü desenini izler (bkz. Faz G/P3: bu deseni gerçek
# ES export/import'a çevirme serisi). ESLint/TS kurulmadığı için bu, o
# refactor yönünün YENİ commit'lerle tersine gitmediğini (yeni bare window
# köprüsü eklenmediğini) doğrulayan hafif bir "linter" görevi görür.
#
# innerHTML baseline gate'iyle aynı desen: mevcut bilinen sayılar
# (scripts/window-bridge-baseline.txt) commit'i engellemez, bir dosyanın
# sayısı baseline'daki değerin ÜZERİNE çıkarsa (yeni köprü eklendiyse) engeller.
# Sayı azalırsa (köprü gerçek import'a çevrildiyse) sorun değil — hatta
# `--update` ile baseline'ı yeni (daha düşük) sayıya indirmek teşvik edilir.
#
# Kurulum GEREKTİRMEZ — sadece Python standart kütüphanesi.
#
# Kullanım:
#   python3 scripts/check-window-bridge-baseline.py              # tüm kök .js dosyalarını kontrol et
#   python3 scripts/check-window-bridge-baseline.py file1.js ...  # sadece verilen dosyaları kontrol et (pre-commit'ten)
#   python3 scripts/check-window-bridge-baseline.py --update      # baseline'ı güncel sayımlarla yeniden yaz

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE_FILE = ROOT / "scripts" / "window-bridge-baseline.txt"

# `window.foo = ...` veya `window.foo=...` (ör: window._isInstitutionalAdmin = (data, isOwner) => ...)
BRIDGE_RE = re.compile(r"window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)")


def count_bridges(path: Path) -> int:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return 0
    return len(BRIDGE_RE.findall(text))


def load_baseline() -> dict:
    if not BASELINE_FILE.exists():
        return {}
    baseline = {}
    for line in BASELINE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, _, count = line.rpartition(":")
        if name:
            baseline[name] = int(count)
    return baseline


def write_baseline(counts: dict):
    lines = [
        "# window.foo = ... köprü sayısı baseline'ı (dosya:sayı).",
        "# check-window-bridge-baseline.py tarafından üretilir/okunur.",
        "# Elle düzenlemeyin — `python3 scripts/check-window-bridge-baseline.py --update` çalıştırın.",
    ]
    for name in sorted(counts):
        if counts[name] > 0:
            lines.append(f"{name}:{counts[name]}")
    BASELINE_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def collect_root_js_files():
    return sorted(p for p in list(ROOT.glob("*.js")) + list((ROOT / "state").glob("*.js")))


def main():
    args = sys.argv[1:]
    update_mode = "--update" in args
    file_args = [a for a in args if not a.startswith("--")]

    if update_mode:
        counts = {p.name: count_bridges(p) for p in collect_root_js_files()}
        write_baseline(counts)
        total = sum(counts.values())
        print(f"✓ Baseline güncellendi: {len(counts)} dosya, toplam {total} köprü.")
        return

    baseline = load_baseline()
    targets = [ROOT / f for f in file_args] if file_args else collect_root_js_files()

    regressions = []
    for path in targets:
        if not path.exists() or path.suffix != ".js":
            continue
        current = count_bridges(path)
        known = baseline.get(path.name, 0)
        if current > known:
            regressions.append((path.name, known, current))

    if regressions:
        print("YENİ window.foo = köprüsü tespit edildi (Faz G/P3 yönüne ters):", file=sys.stderr)
        for name, known, current in regressions:
            print(f"  {name}: baseline {known} → şimdi {current} (+{current - known})", file=sys.stderr)
        print(
            "\nBu bilinçli bir tercihse (ör. inline HTML handler için gerekli global): "
            "`python3 scripts/check-window-bridge-baseline.py --update` ile baseline'ı güncelleyin ve tekrar commit edin.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("✓ Yeni window.foo = köprüsü yok.")


if __name__ == "__main__":
    main()
