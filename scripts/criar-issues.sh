#!/usr/bin/env bash
# Cria milestone e issues a partir de uma pasta de arquivos .md (mesmo formato de .github/seed/issues).
# Requisitos: GitHub CLI (gh) autenticado (`gh auth login`).
# Uso:
#   scripts/criar-issues.sh --dry-run .github/seed/issues-v2     # só mostra o que faria
#   scripts/criar-issues.sh .github/seed/issues-v2               # cria de verdade
#   scripts/criar-issues.sh .github/seed/issues-v2 dono/repo     # informa o repositório
# Seguro para repetir: issues com o mesmo título e milestones existentes são puladas.
# Importante: os labels usados nos arquivos precisam existir (rode antes scripts/seed-github.sh, se necessário).
set -euo pipefail

DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
DIR="${1:?Informe a pasta com os .md das issues}"
[[ -d "$DIR" ]] || { echo "Pasta não encontrada: $DIR"; exit 1; }

if [[ $DRY -eq 0 ]]; then
  command -v gh >/dev/null || { echo "Instale o GitHub CLI: https://cli.github.com"; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "Faça login primeiro: gh auth login"; exit 1; }
  REPO="${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
else
  REPO="${2:-DONO/REPOSITORIO}"
fi
echo "Repositório: $REPO  (dry-run=$DRY)"

run() { if [[ $DRY -eq 1 ]]; then echo "[dry-run] $*"; else "$@"; fi; }

existing_ms=""; existing_titles=""
if [[ $DRY -eq 0 ]]; then
  existing_ms="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')"
  existing_titles="$(gh issue list --repo "$REPO" --state all --limit 1000 --json title --jq '.[].title')"
fi

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
created=0
declare -A ms_done=()
for f in "$DIR"/*.md; do
  head5="$(head -5 "$f")"
  title="$(sed -n 's/^title: //p' <<<"$head5" | head -1)"
  labels="$(sed -n 's/^labels: //p' <<<"$head5" | head -1)"
  milestone="$(sed -n 's/^milestone: //p' <<<"$head5" | head -1)"
  if [[ -n "$milestone" && -z "${ms_done[$milestone]:-}" ]]; then
    if grep -qxF "$milestone" <<<"$existing_ms"; then echo "milestone já existe: $milestone"
    else run gh api "repos/$REPO/milestones" --silent -f title="$milestone"; fi
    ms_done[$milestone]=1
  fi
  if grep -qxF "$title" <<<"$existing_titles"; then echo "já existe: $title"; continue; fi
  awk 'BEGIN{c=0} /^---$/ && c<2 {c++; next} c>=2' "$f" > "$tmp"
  args=(); IFS=',' read -ra L <<<"$labels"
  for l in "${L[@]}"; do
    l="$(echo "$l" | sed 's/^ *//;s/ *$//')"  # trim
    [[ -n "$l" ]] && args+=(--label "$l")
  done
  [[ -n "$milestone" ]] && args+=(--milestone "$milestone")
  run gh issue create --repo "$REPO" --title "$title" --body-file "$tmp" "${args[@]}"
  created=$((created+1))
  [[ $DRY -eq 0 ]] && sleep 1
done
echo "Pronto. Issues criadas: $created"
