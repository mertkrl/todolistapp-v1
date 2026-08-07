#!/usr/bin/env python3
# Cross-module bağımlılık denetleyici (ESLint kurmadan "no-undef" muadili).
#
# NEDEN: Faz 5'te (social-group-details.js çıkarması) iki ayrı Explore ajanının
# manuel taraması, gerçekte var olan 15 çapraz-dosya bağımlılığından sadece
# 3'ünü buldu. Kalan 12'si ancak tek seferlik bir Python script'iyle ortaya
# çıktı. Bu script o taramayı KALICI ve TEKRARLANABİLİR hale getiriyor.
#
# MANTIK: Bu proje framework kullanmıyor (vanilla JS + Vite). Her .js dosyası
# ya "modül kapsamlı" (index.html'de type="module" src=... İLE ya da dynamic
# import() İLE yükleniyor — ES modül izolasyonu var, dosyalar arası bare
# identifier paylaşımı YOK, sadece window.* köprüsü veya static import
# çalışır) ya da "classic script" (inline-*.js gibi, type="module" YOK —
# sayfadaki tüm classic script'ler TEK bir global kapsamı paylaşır, aralarında
# bare paylaşım NORMAL ve BEKLENEN).
#
# Bu script SADECE modül-kapsamlı dosyalar arasındaki riskli deseni arar:
# dosya A'da bare çağrılan bir isim, SADECE dosya B'de (window'a atanmamış)
# yerel olarak tanımlıysa → A, B kaldırılırsa/taşınırsa veya modül sırası
# değişirse sessizce kırılabilir.
#
# SINIRLAMA: Bu gerçek bir JS parser'ı değil, regex tabanlı statik analizdir.
# Yanlış pozitif/negatif olabilir — bulgular gözden geçirilmeli.
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent

# index.html içinde <script type="module" src="..."> ile yüklenen dosyalar +
# dynamic import() ile yüklenen dosyalar (inline-module-loader.js ve
# import() kullanan script-*.js dosyaları taranarak) — bunların HEPSİ kendi
# izole ES modül kapsamına sahip.
def find_static_module_files():
    html = (BASE / 'index.html').read_text(encoding='utf-8')
    return set(re.findall(r'<script type="module" src="([^"]+)"', html))


def find_dynamic_module_files():
    files = set()
    for js in list(BASE.glob('*.js')) + list((BASE / 'js').glob('*.js')):
        try:
            src = js.read_text(encoding='utf-8')
        except Exception:
            continue
        for m in re.finditer(r"import\(['\"]\./([^'\"]+)['\"]\)", src):
            files.add(m.group(1))
    return files


JS_BUILTINS = {
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'of', 'in', 'do',
    'else', 'try', 'finally', 'throw', 'delete', 'void', 'instanceof', 'yield', 'await', 'async',
    'Array', 'Object', 'Math', 'JSON', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Number', 'String',
    'Boolean', 'Date', 'Function', 'Proxy', 'Reflect', 'Intl',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
    'cancelAnimationFrame', 'queueMicrotask',
    'console', 'fetch', 'Error', 'TypeError', 'RangeError', 'RegExp', 'Symbol', 'structuredClone',
    'crypto', 'window', 'document', 'navigator', 'location', 'history', 'localStorage',
    'sessionStorage', 'self', 'globalThis', 'alert', 'confirm', 'prompt', 'Blob', 'File', 'FileReader',
    'FormData', 'URL', 'URLSearchParams', 'Headers', 'Request', 'Response', 'AbortController',
    'CustomEvent', 'Event', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'performance', 'requestIdleCallback', 'matchMedia', 'getComputedStyle', 'Image', 'Audio',
    'Notification', 'Worker', 'ServiceWorkerRegistration', 'caches', 'indexedDB',
}


def local_decls(src):
    names = set()
    for m in re.finditer(r'\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(', src):
        names.add(m.group(1))
    for m in re.finditer(r'\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)', src):
        names.add(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=', src):
        names.add(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var)\s*\{([^{}]*)\}\s*=', src):
        for p in m.group(1).split(','):
            p = p.split(':')[0].split('=')[0].strip().lstrip('.')
            if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', p):
                names.add(p)
    for m in re.finditer(r'\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)', src):
        names.add(m.group(1))
    for m in re.finditer(r'\bimport\s*\{([^}]*)\}\s*from', src):
        for p in m.group(1).split(','):
            p = p.strip()
            p = p.split(' as ')[-1].strip()
            if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', p):
                names.add(p)
    for m in re.finditer(r'function\s*[A-Za-z_$]*\s*\(([^)]*)\)', src):
        for p in m.group(1).split(','):
            p = p.strip().split('=')[0].strip().lstrip('.')
            if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', p):
                names.add(p)
    for m in re.finditer(r'\(([^()]*)\)\s*=>', src):
        for p in m.group(1).split(','):
            p = p.strip().split('=')[0].strip().lstrip('.')
            if re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', p):
                names.add(p)
    for m in re.finditer(r'catch\s*\(([A-Za-z_$][A-Za-z0-9_$]*)\)', src):
        names.add(m.group(1))
    return names


def window_exposed(src):
    return set(re.findall(r'\bwindow\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=', src))


def bare_calls(src):
    return set(re.findall(r'(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(', src))


def bare_typeof_guards(src):
    # `typeof X === 'function'` / `typeof X !== 'undefined'` gibi guard'lar —
    # X taşınırsa hata FIRLATMAZ, sessizce false'a düşer (bkz. ARCHITECTURE.md
    # ders #2). bare_calls() bunları YAKALAMAZ çünkü X'ten sonra '(' gelmez.
    return set(re.findall(r"\btypeof\s+([A-Za-z_$][A-Za-z0-9_$]*)\b", src))


def bare_const_refs(src):
    # SABİT_İSİMLİ (UPPER_SNAKE_CASE) bare referanslar — fonksiyon çağrısı
    # OLMAYAN, sadece değer olarak kullanılan paylaşılan sabitler (ör.
    # `accent: TEACHER_NOTIF_ACCENT`). Bunlar taşınırsa hata FIRLATIR
    # (ReferenceError) — typeof guard'ının aksine sessiz değil ama bare_calls()
    # yine de yakalamaz çünkü ardından '(' gelmez. Gürültüyü azaltmak için
    # SADECE tamamı büyük harf+alt çizgi olan isimlerle sınırlı.
    return set(re.findall(r'(?<![.\w$])([A-Z][A-Z0-9_]{2,})\b(?!\s*\()', src))


def main():
    static_files = find_static_module_files()
    dynamic_files = find_dynamic_module_files()
    module_files = sorted(static_files | dynamic_files)

    file_data = {}
    for fname in module_files:
        p = BASE / fname
        if not p.exists():
            continue
        src = p.read_text(encoding='utf-8')
        file_data[fname] = {
            'local': local_decls(src),
            'window': window_exposed(src),
            'calls': bare_calls(src),
            'typeof_guards': bare_typeof_guards(src),
            'const_refs': bare_const_refs(src),
        }

    # Bir isim SADECE tek bir dosyada yerel tanımlı VE o dosyada window'a
    # atanmamışsa, o dosyanın "özel" (private) ismi sayılır.
    from collections import defaultdict
    owners = defaultdict(list)
    for fname, d in file_data.items():
        for name in d['local']:
            owners[name].append(fname)

    globally_window_exposed = set()
    for d in file_data.values():
        globally_window_exposed |= d['window']

    findings = []
    for fname, d in file_data.items():
        for call in d['calls']:
            if call in d['local'] or call in JS_BUILTINS or call in globally_window_exposed:
                continue
            if len(call) <= 2:
                continue
            owner_files = [f for f in owners.get(call, []) if f != fname]
            if len(owner_files) == 1:
                findings.append((fname, call, owner_files[0], 'çağrı'))

        for name in d['typeof_guards']:
            if name in d['local'] or name in JS_BUILTINS or name in globally_window_exposed:
                continue
            if len(name) <= 2:
                continue
            owner_files = [f for f in owners.get(name, []) if f != fname]
            if len(owner_files) == 1:
                findings.append((fname, name, owner_files[0], 'typeof guard'))

        for name in d['const_refs']:
            if name in d['local'] or name in JS_BUILTINS or name in globally_window_exposed:
                continue
            owner_files = [f for f in owners.get(name, []) if f != fname]
            if len(owner_files) == 1:
                findings.append((fname, name, owner_files[0], 'sabit referans'))

    if not findings:
        print("Çapraz-modül köprü sorunu bulunamadı.", file=sys.stderr)
        return 0

    print(f"{len(findings)} olası köprüsüz çapraz-modül bağımlılığı bulundu:\n")
    for fname, name, owner, kind in sorted(findings):
        if kind == 'typeof guard':
            print(f"  {fname}: 'typeof {name}'  →  sadece {owner}'de yerel tanımlı (window'a atanmamış) — GUARD, sessizce false'a düşer")
        elif kind == 'sabit referans':
            print(f"  {fname}: sabit referans '{name}'  →  sadece {owner}'de yerel tanımlı (window'a atanmamış) — ReferenceError riski")
        else:
            print(f"  {fname}: bare '{name}(...)'  →  sadece {owner}'de yerel tanımlı (window'a atanmamış)")
    print("\nBunlar YANLIŞ POZİTİF olabilir (regex tabanlı, gerçek parser değil) — gözden geçirin.")
    print("Gerçekse: tanım dosyasında `window.X = X;` ekleyip çağrı dosyasında `window.X(...)`'e çevirin.")
    return 1


if __name__ == '__main__':
    sys.exit(main())
