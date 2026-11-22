#!/usr/bin/env bash
# Builds the Taiwan drug data on this computer and pushes it to the branch tw-drugs-data, exactly as
# .github/workflows/tw-drugs.yml does on GitHub. It exists because the NHI site may refuse GitHub's servers
# (they are outside Taiwan): run from a computer in Taiwan, every source can be reached.
# Needs: git (signed in to GitHub), node, curl, unzip, pdftotext — all come with Git for Windows + Node.js.
# Run it from Git Bash:  bash .github/scripts/tw-drugs-local.sh
# A Windows scheduled task ("Research Toolkit drug data") runs it every Monday; the log is
# Research-toolkit/data/tw-drugs-local.log (that folder is not committed).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL="$REPO/Research-toolkit/data/tw-drugs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$REPO" || exit 1
REMOTE="$(git remote get-url origin)"
echo "== $(date '+%F %T') Taiwan drug data, built locally"

# last published data: the fallback for any source that cannot be downloaded, and the rule texts already converted
mkdir -p "$WORK/prev" "$WORK/src"
git fetch -q origin tw-drugs-data 2>/dev/null || true
for f in meta nhi hist fda extra rules; do
  git show "origin/tw-drugs-data:$f.json" > "$WORK/prev/$f.json" 2>/dev/null || rm -f "$WORK/prev/$f.json"
done
# before the branch has rule texts, reuse the ones converted on this computer
[ -f "$WORK/prev/rules.json" ] || { [ -f "$LOCAL/rules.json" ] && cp "$LOCAL/rules.json" "$WORK/prev/rules.json"; }

get() { curl -fsSL --retry 4 --retry-all-errors --retry-delay 20 --connect-timeout 30 --max-time 900 -A "Mozilla/5.0" -o "$1" "$2"; }
size() { wc -c < "$1" 2>/dev/null || echo 0; }

if get "$WORK/src/nhi.csv" "https://info.nhi.gov.tw/api/iode0000s01/Dataset?rId=A21030000I-E41001-001" && [ "$(size "$WORK/src/nhi.csv")" -gt 20000000 ]; then
  NHI="$WORK/src/nhi.csv"
else
  echo "NHI drug list could not be downloaded; keeping last week's"; NHI="$WORK/prev/nhi.json"
fi
declare -A PICK
for pair in "36:LIC:fda.json:10000000" "42:LOOKS:extra.json:100000" "39:LEAF:extra.json:1000000"; do
  IFS=: read -r id var prev min <<< "$pair"
  csv=""
  if get "$WORK/src/fda$id.zip" "https://data.fda.gov.tw/data/opendata/export/$id/csv"; then
    mkdir -p "$WORK/src/fda$id" && unzip -o -q "$WORK/src/fda$id.zip" -d "$WORK/src/fda$id"
    for c in "$WORK/src/fda$id"/*.csv; do [ -f "$c" ] && [ "$(size "$c")" -gt "$min" ] && { csv="$c"; break; }; done
  fi
  if [ -n "$csv" ]; then PICK[$var]="$csv"; else echo "TFDA dataset $id could not be downloaded; keeping last week's"; PICK[$var]="$WORK/prev/$prev"; fi
done
for f in "$NHI" "${PICK[LIC]}"; do [ -f "$f" ] || { echo "ERROR: $f missing and no earlier data to fall back on"; exit 1; }; done

node .github/scripts/tw-drugs.mjs "$NHI" "${PICK[LIC]}" "$WORK/out" "${PICK[LOOKS]}" "${PICK[LEAF]}" || exit 1
node .github/scripts/tw-drug-rules.mjs "$WORK/out" "$WORK/prev/rules.json" 2>&1 | grep -v '^Syntax Error' || true
[ -f "$WORK/out/rules.json" ] || { echo "ERROR: rules.json was not written"; exit 1; }

# keep the local copy that localhost testing reads up to date
mkdir -p "$LOCAL" && cp "$WORK/out/"*.json "$LOCAL/"

if [ -f "$WORK/prev/meta.json" ] && [ "$(node -p "require(process.argv[1]).v" "$WORK/prev/meta.json")" = "$(node -p "require(process.argv[1]).v" "$WORK/out/meta.json")" ]; then
  echo "Data unchanged; nothing to publish."; exit 0
fi
cd "$WORK/out" || exit 1
git init -q -b tw-drugs-data
printf 'Taiwan drug data for Research Toolkit, rebuilt weekly by .github/workflows/tw-drugs.yml or .github/scripts/tw-drugs-local.sh on main.\nSources: NHI 健保用藥品項 and 藥品給付規定; TFDA 全部藥品許可證資料集, 藥品外觀資料集, 藥品仿單外盒資料集 (Open Government Data License, Taiwan, v1.0).\n' > README.md
git add -A
git commit -q -m "Taiwan drug data $(node -p "require('./meta.json').built") (built locally)"
git push -q -f "$REMOTE" tw-drugs-data && echo "Published to tw-drugs-data."
