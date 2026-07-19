#!/usr/bin/env python3
# Pre-commit gate: check-innerhtml.py'nin ham sonucunu bir "baseline" (mevcut
# bilinen bulgular) listesiyle karşılaştırır. Sadece BASELINE'DA OLMAYAN yeni
# bulgular commit'i engeller; eski/bilinen bulgular (henüz düzeltilmemiş
# olanlar) commit'i durdurmaz. Amaç: var olan teknik borcu commit'i kilitlemeden,
# yeni escape edilmemiş innerHTML enjeksiyonunun eklenmesini engellemek.
#
# Satır numarası kaymalarından etkilenmemek için eşleştirme (dosya, ifade)
# ikilisine ve bu ikilinin dosya içindeki tekrar sayısına (Counter) göre yapılır.
import subprocess
import sys
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
BASELINE_FILE = BASE / "scripts" / "innerhtml-baseline.txt"
CHECK_SCRIPT = BASE / "scripts" / "check-innerhtml.py"


def parse_findings(text):
    """'dosya:satır  ${ifade}' satırlarını (dosya, ifade) ikililerine çevirir."""
    pairs = []
    for line in text.splitlines():
        line = line.rstrip("\n")
        if not line or ":" not in line:
            continue
        head, _, rest = line.partition("  ")
        fname, _, _lineno = head.partition(":")
        if not fname or not rest:
            continue
        pairs.append((fname, rest))
    return pairs


def load_baseline():
    if not BASELINE_FILE.exists():
        return Counter()
    return Counter(parse_findings(BASELINE_FILE.read_text(encoding="utf-8")))


def run_check(files):
    args = [sys.executable, str(CHECK_SCRIPT)] + files
    proc = subprocess.run(args, cwd=str(BASE), capture_output=True, text=True)
    return proc.stdout


def main():
    staged = sys.argv[1:]
    if not staged:
        return 0

    current_output = run_check(staged)
    current_counts = Counter(parse_findings(current_output))
    baseline_counts = load_baseline()

    new_items = []
    for key, count in current_counts.items():
        extra = count - baseline_counts.get(key, 0)
        if extra > 0:
            new_items.append((key, extra))

    if not new_items:
        return 0

    print("YENİ escape edilmemiş innerHTML enjeksiyonu tespit edildi:\n", file=sys.stderr)
    for (fname, expr), extra in new_items:
        marker = f" (x{extra})" if extra > 1 else ""
        print(f"  {fname}  {expr}{marker}", file=sys.stderr)
    print(
        "\nBu değerler kullanıcı girdisi taşıyorsa escapeHtml()/esc() ile sarmalayın.\n"
        "Yanlış pozitifse (gerçekten güvenliyse) scripts/innerhtml-baseline.txt dosyasını\n"
        "güncelleyerek (python3 scripts/check-innerhtml.py > scripts/innerhtml-baseline.txt)\n"
        "bu bulguyu bilinen listeye ekleyebilirsiniz.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
