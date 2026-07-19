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
        if not src.startswith('.innerHTML', i):
            i += 1
            continue
        j = i + len('.innerHTML')
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

        if k < n and src[k] == '`':
            i = process_template(src, k, escaped_vars, findings)
            continue

        m = MAP_CHAIN_RE.match(src, k)
        if m:
            # m sonu, .map( çağrısının '(' karakterinden hemen sonrası
            paren_open = m.end() - 1
            map_end = skip_parens(src, paren_open)
            scan_templates_in_span(src, m.end(), map_end - 1, escaped_vars, findings)
            i = map_end
            continue

        i = j

    return findings


def main():
    files = sys.argv[1:] or [
        'script.js', 'script-ambient-sounds.js', 'script-undo-toast.js', 'script-nlp.js',
        'script-system-settings.js', 'script-profile-edit.js', 'script-settings-steppers.js',
        'planning-wizard-info-tooltip.js', 'planning-ghost-toast.js',
        'planning.js', 'social.js', 'collab.js', 'auth-ui.js',
        'social-roles.js', 'social-gamification.js', 'social-chat-extras.js', 'social-polls.js',
        'social-notif-sounds.js', 'social-buddy-habits.js', 'social-online-friends.js',
        'social-activity-feed.js', 'social-daily-race.js', 'social-online-people-popover.js',
        'social-assignments-badge.js', 'social-focus-hush.js', 'social-unread-divider.js',
        'social-chat-search.js',
        'social-chat-clear.js',
        'social-sidebar-profile.js',
        'script-journal-library.js', 'script-command-palette.js',
        'script-mind-dump-drawer.js', 'script-onboarding-tour.js',
        'script-calendar-dragdrop.js', 'script-calendar-hover-popup.js', 'script-timer-flame.js',
        'script-day-summary-card.js', 'script-milestone-auto-splitter.js',
        'script-goal-archiver.js', 'script-goal-deadline-extend.js',
        'script-task-end-question.js', 'script-milestone-goal-actions.js',
        'storage-manager.js', 'auth-ui.js', 'state-store.js',
        'inline-error-net.js', 'inline-tab-restore-early.js', 'inline-tab-restore-dom.js',
        'inline-module-loader.js', 'inline-dock-topbar-init.js', 'inline-sw-register.js',
        'inline-button-failsafe.js', 'inline-goal-modal-globals.js', 'inline-a11y-patch.js',
        'inline-onclick-migration.js',
    ]
    base = Path.cwd()
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
