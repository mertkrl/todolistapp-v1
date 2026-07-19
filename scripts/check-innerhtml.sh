#!/usr/bin/env bash
# innerHTML + değişken enjeksiyonu (${...}) taraması. Gerçek iş
# check-innerhtml.py'de yapılıyor (backtick/${}/{}/string tokenizer'ı —
# çok satırlı template literal'leri de doğru ayrıştırır, eski grep tabanlı
# sürüm bunları kaçırıyordu). Bu dosya sadece ince bir çağırıcı, eski komut
# arayüzünü (dosya listesi argümanı, exit code) korumak için var.
#
# Kullanım:
#   ./scripts/check-innerhtml.sh              → varsayılan .js dosyalarını tara
#   ./scripts/check-innerhtml.sh script.js     → tek dosyayı tara
#
# Git hook olarak bağlamak için:
#   ln -s ../../scripts/check-innerhtml.sh .git/hooks/pre-commit

set -euo pipefail
cd "$(dirname "$0")/.."

exec python3 scripts/check-innerhtml.py "$@"
