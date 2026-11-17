#!/usr/bin/env bash
# Roda cada arquivo de teste em um processo separado.
# Motivo: mock.module do bun vale para o processo inteiro e "vaza" entre arquivos
# (ex.: billing-webhook mocka orgPlan e quebra billing-internal-key no Linux).
set -u
cd "$(dirname "$0")/.."
falhou=0
for f in tests/*.test.*; do
  [ -e "$f" ] || continue
  echo "── $f"
  bun test "$f" || falhou=1
done
exit $falhou
