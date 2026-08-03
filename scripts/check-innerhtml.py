#!/usr/bin/env python3
# innerHTML + ${...} enjeksiyonu taraması (v3).
#
# Eski scripts/check-innerhtml.sh (saf grep) sadece TEK SATIRLIK
# `.innerHTML = \`...${x}...\`` atamalarını yakalıyordu; çok satırlı template
# literal'leri (bu kod tabanında en yaygın desen) hiç görmüyordu. v2 gerçek
# bir backtick/${}/{}/string tokenizer'ı ile bunu çözdü.
#
# v3 ek olarak DOLAYLI atamaları da yakalıyor:
#   element.innerHTML = liste.map(x => `...${x.ad}...`).join('')
# v2 bunu görmüyordu çünkü ".innerHTML = " hemen ardından backtick (`) değil,
# bir değişken + ".map(" bekliyordu. Bu kalıp kod tabanında 55+ kez kullanılıyor
# (arkadaş/grup/üye listeleri gibi tam olarak kullanıcı verisinin aktığı
# yerlerde) ve gerçek bir escape edilmemiş kullanıcı adı bulgusu (bkz.
# social-gamification.js renderStreakRace) tam olarak bu kalıpta saklıydı.
#
# Artık ".innerHTML = <ifade>.map(" görüldüğünde, map() çağrısının parantez
# içini (callback gövdesini) bulup İÇİNDEKİ tüm backtick template literal'lerini
# tarıyoruz — callback ister tek satırlık ok fonksiyonu (`x => \`...\``) ister
# gövdeli fonksiyon (`x => { ...; return \`...\`; }`) olsun.
#
# Bir ${expr} şu durumlarda GÜVENLİ sayılır (raporlanmaz):
#   - expr içinde doğrudan esc(/escapeHtml(/_escapeHtml( çağrısı varsa
#   - expr tek bir değişken adıysa VE o değişken dosyanın başka bir yerinde
#     `const/let/var X = escapeHtml(...)` ile atanmışsa
#   - expr sayısal/boolean/uzunluk gibi açıkça kullanıcı metni olmayan
#     kalıplardan biriyse (.length, count, Math.xxx(), sabit ternary vb.)
#
# Yine de bu bir gerçek JS parser'ı DEĞİL — statik analiz kesin değildir.
# Bulgular gözden geçirilmeli; "kullanıcı verisi mi?" sorusunu script yanıtlayamaz.
import re
import sys
from pathlib import Path


def skip_string(src, k, quote):
    n = len(src)
    k += 1
    while k < n:
        c = src[k]
        if c == '\\':
            k += 2
            continue
        if c == quote:
            return k + 1
        k += 1
    return k


def skip_template(src, k, interps=None, collect=False):
    """src[k] == '`'. Returns index just past the matching closing backtick.
    If collect, appends (start,end) of each top-level ${...} body to interps."""
    n = len(src)
    k += 1
    while k < n:
        c = src[k]
        if c == '\\':
            k += 2
            continue
        if c == '`':
            return k + 1
        if c == '$' and k + 1 < n and src[k + 1] == '{':
            body_start = k + 2
            end = skip_expression(src, body_start)
            if collect:
                interps.append((body_start, end - 1))  # end-1 excludes the closing '}'
            k = end
            continue
        k += 1
    return k


def skip_expression(src, k):
    """src[k-1] was the '{' following '${'. Skip until the matching '}' (depth 1)."""
    n = len(src)
    depth = 1
    while k < n:
        c = src[k]
        if c == '\\':
            k += 2
            continue
        if c == '{':
            depth += 1
            k += 1
            continue
        if c == '}':
            depth -= 1
            k += 1
            if depth == 0:
                return k
            continue
        if c in ("'", '"'):
            k = skip_string(src, k, c)
            continue
        if c == '`':
            k = skip_template(src, k)
            continue
        if c == '/' and k + 1 < n and src[k + 1] == '/':
            nl = src.find('\n', k)
            k = nl if nl != -1 else n
            continue
        if c == '/' and k + 1 < n and src[k + 1] == '*':
            end = src.find('*/', k + 2)
            k = end + 2 if end != -1 else n
            continue
        k += 1
    return k


def skip_parens(src, k):
    """src[k] == '('. Returns index just past the matching ')'."""
    n = len(src)
    depth = 0
    while k < n:
        c = src[k]
        if c == '\\':
            k += 2
            continue
        if c == '(':
            depth += 1
            k += 1
            continue
        if c == ')':
            depth -= 1
            k += 1
            if depth == 0:
                return k
            continue
        if c in ("'", '"'):
            k = skip_string(src, k, c)
            continue
        if c == '`':
            k = skip_template(src, k)
            continue
        if c == '/' and k + 1 < n and src[k + 1] == '/':
            nl = src.find('\n', k)
            k = nl if nl != -1 else n
            continue
        if c == '/' and k + 1 < n and src[k + 1] == '*':
            end = src.find('*/', k + 2)
            k = end + 2 if end != -1 else n
            continue
        k += 1
    return k


ESCAPE_CALL_RE = re.compile(r'\b(?:_escapeHtml|escapeHtml|esc)\s*\(')
ASSIGN_ESCAPED_RE = re.compile(
    r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?(?:_escapeHtml|escapeHtml|esc)\s*\('
)
SIMPLE_IDENT_RE = re.compile(r'^[A-Za-z_$][\w$]*$')
SAFE_LITERAL_RE = re.compile(
    r'^(?:[\w.]*\.length|[\w.]*[Cc]ount\w*|\d+|true|false|null|undefined'
    r'|Math\.[\w.]+\([^()]*\)|String\([^()]*\)\.padStart\([^()]*\))$'
)
SAFE_TERNARY_RE = re.compile(
    r'^[\w.?]+\s*\?\s*[\'"][^\'"$]*[\'"]\s*:\s*[\'"][^\'"$]*[\'"]$'
)
# "liste.map(" / "a.b.map(" / "arr[0].map(" gibi bir üye zincirinin hemen
# ardından .map( gelen kalıp — dolaylı innerHTML atamalarını yakalamak için.
MAP_CHAIN_RE = re.compile(
    r'[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\[\]]*\])*\s*\.\s*map\s*\('
)


def check_interps(src, interps, escaped_vars, findings):
    for (es, ee) in interps:
        expr = src[es:ee].strip()
        if not expr:
            continue
        if ESCAPE_CALL_RE.search(expr):
            continue
        if SAFE_LITERAL_RE.match(expr):
            continue
        if SAFE_TERNARY_RE.match(expr):
            continue
        if SIMPLE_IDENT_RE.match(expr) and expr in escaped_vars:
            continue
        eline = src.count('\n', 0, es) + 1
        one_line = ' '.join(expr.split())
        snippet = one_line if len(one_line) <= 100 else one_line[:97] + '...'
        findings.append((eline, snippet))


def process_template(src, lit_start, escaped_vars, findings):
    """src[lit_start] == '`'. Ayrıştırır, ${} bulgularını findings'e ekler,
    kapanış backtick'inden sonraki index'i döndürür."""
    interps = []
    lit_end = skip_template(src, lit_start, interps, collect=True)
    check_interps(src, interps, escaped_vars, findings)
    return lit_end


def scan_templates_in_span(src, start, end, escaped_vars, findings):
    """[start,end) aralığında (bir .map(...) çağrısının gövdesi) üst seviyede
    rastlanan HER backtick template literal'ini bulup tarar — string/yorum
    içindeki backtick'leri atlayarak."""
    k = start
    while k < end:
        c = src[k]
        if c in ("'", '"'):
            k = skip_string(src, k, c)
            continue
        if c == '/' and k + 1 < end and src[k + 1] == '/':
            nl = src.find('\n', k, end)
            k = nl if nl != -1 else end
            continue
        if c == '/' and k + 1 < end and src[k + 1] == '*':
            e = src.find('*/', k + 2, end)
            k = e + 2 if e != -1 else end
            continue
        if c == '`':
            k = process_template(src, k, escaped_vars, findings)
            continue
        k += 1


# .innerHTML/.outerHTML atamaları VE .insertAdjacentHTML(...) çağrılarının
# ikinci argümanı — üçü de aynı XSS sınıfına giriyor, üçü de taranmalı.
ASSIGNMENT_PROPS = ('.innerHTML', '.outerHTML')


def scan_assignment_target(src, k, n, escaped_vars, findings):
    """k, '=' işaretinden hemen sonraki ifadenin başlangıcı. Backtick template
    veya .map(...) zincirini tarar. Bir sonraki tarama pozisyonunu döndürür."""
    if k < n and src[k] == '`':
        return process_template(src, k, escaped_vars, findings)
    m = MAP_CHAIN_RE.match(src, k)
    if m:
        paren_open = m.end() - 1
        map_end = skip_parens(src, paren_open)
        scan_templates_in_span(src, m.end(), map_end - 1, escaped_vars, findings)
        return map_end
    return None


def scan_file(path: Path):
    src = path.read_text(encoding='utf-8', errors='replace')
    escaped_vars = {m.group(1) for m in ASSIGN_ESCAPED_RE.finditer(src)}

    findings = []
    n = len(src)
    i = 0
    while i < n:
        c = src[i]
        if c != '.':
            i += 1
            continue

        prop = next((p for p in ASSIGNMENT_PROPS if src.startswith(p, i)), None)
        if prop:
            j = i + len(prop)
            # skip whitespace, optional '+', '='
            k = j
            while k < n and src[k] in ' \t':
                k += 1
            if k < n and src[k] == '+':
                k += 1
            while k < n and src[k] in ' \t':
                k += 1
            if k >= n or src[k] != '=':
                i = j
                continue
            k += 1
            while k < n and src[k] in ' \t\n':
                k += 1

            nxt = scan_assignment_target(src, k, n, escaped_vars, findings)
            if nxt is not None:
                i = nxt
                continue
            i = j
            continue

        if src.startswith('.insertAdjacentHTML', i):
            j = i + len('.insertAdjacentHTML')
            k = j
            while k < n and src[k] in ' \t\n':
                k += 1
            if k >= n or src[k] != '(':
                i = j
                continue
            k += 1
            # ilk argümanı (konum: 'beforeend' vb.) atla, virgüle kadar (derinlik 0)
            depth = 0
            while k < n:
                ch = src[k]
                if ch in ("'", '"'):
                    k = skip_string(src, k, ch)
                    continue
                if ch == '`':
                    k = skip_template(src, k)
                    continue
                if ch in '([{':
                    depth += 1
                    k += 1
                    continue
                if ch in ')]}':
                    if depth == 0:
                        break
                    depth -= 1
                    k += 1
                    continue
                if ch == ',' and depth == 0:
                    k += 1
                    break
                k += 1
            while k < n and src[k] in ' \t\n':
                k += 1

            nxt = scan_assignment_target(src, k, n, escaped_vars, findings)
            if nxt is not None:
                i = nxt
                continue
            i = j
            continue

        i += 1

    return findings


# Taramaya dahil edilmeyen dizinler: bağımlılıklar, build çıktısı, git içi.
EXCLUDED_DIRS = {'node_modules', 'dist', '.git', '.vite'}


def discover_files(base: Path):
    """Repo kökündeki tüm .js dosyaları + index.html — sabit bir listeye değil,
    dosya sistemine dayanır; yeni eklenen dosyalar otomatik kapsama girer."""
    found = []
    for p in sorted(base.rglob('*.js')):
        if any(part in EXCLUDED_DIRS for part in p.relative_to(base).parts):
            continue
        found.append(p.relative_to(base).as_posix())
    index_html = base / 'index.html'
    if index_html.exists():
        found.append('index.html')
    return found


def main():
    base = Path.cwd()
    files = sys.argv[1:] or discover_files(base)
    total = 0
    for f in files:
        p = base / f
        if not p.exists():
            continue
        for lineno, expr in scan_file(p):
            total += 1
            print(f"{f}:{lineno}  ${{{expr}}}")
    print(f"\n{total} potentially-unescaped interpolation(s) found.", file=sys.stderr)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
