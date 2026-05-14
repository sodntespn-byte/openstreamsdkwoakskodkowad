#!/usr/bin/env bash
# Gera um ZIP pequeno para Square Cloud (só código — sem node_modules, .next, .git).
# Uso: npm run zip:deploy
#      bash scripts/squarecloud-zip.sh caminho/saida.zip
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="${1:-$ROOT/superflix-squarecloud.zip}"
rm -f "$OUT"

if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  git archive --format=zip -o "$OUT" HEAD
  SZ=$(du -h "$OUT" | cut -f1)
  echo "ZIP criado: $OUT ($SZ) — apenas ficheiros versionados no Git."
  echo "A Square Cloud instala dependências no deploy; não envie node_modules nem .next."
  exit 0
fi

echo "Aviso: pasta .git não encontrada ou git indisponível."
echo "Criando ZIP com exclusões básicas (confirme o tamanho antes de enviar)."

zip -r -q "$OUT" . \
  -x "node_modules/*" \
  -x "node_modules/**" \
  -x ".next/*" \
  -x ".next/**" \
  -x ".git/*" \
  -x ".git/**" \
  -x "dist/*" \
  -x "build/*" \
  -x "out/*" \
  -x "coverage/*" \
  -x ".turbo/*" \
  -x ".cache/*" \
  -x "__pycache__/*" \
  -x "**/__pycache__/*" \
  -x "venv/*" \
  -x ".env" \
  -x ".env.local" \
  -x ".env.*" \
  -x "*.zip"

SZ=$(du -h "$OUT" | cut -f1)
echo "ZIP criado: $OUT ($SZ)"
