#!/usr/bin/env bash
# Deploy pentru Higher Self, direct in GitHub Pages.
# Tokenul TAU sta doar aici, pe calculatorul tau, in fisierul .deploy.env. Nu il trimite nimanui.
#
# Configurare, o singura data:
#   1. cp deploy.env.example .deploy.env
#   2. deschizi .deploy.env si completezi GH_USER, GH_REPO, GH_TOKEN
#   3. chmod +x deploy.sh
#
# Folosire:
#   ./deploy.sh index.html            (urca doar aplicatia)
#   ./deploy.sh --all                 (urca tot folderul pwa: app + manifest + sw + iconite)

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .deploy.env ]; then
  echo "Lipseste .deploy.env. Copiaza deploy.env.example in .deploy.env si completeaza-l."
  exit 1
fi
# shellcheck disable=SC1091
source .deploy.env
: "${GH_USER:?completeaza GH_USER in .deploy.env}"
: "${GH_REPO:?completeaza GH_REPO in .deploy.env}"
: "${GH_TOKEN:?completeaza GH_TOKEN in .deploy.env}"
BRANCH="${GH_BRANCH:-main}"

api() { curl -sS -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$@"; }

push_file() {
  local path="$1" name="${2:-}"
  [ -z "$name" ] && name="$(basename "$path")"
  [ -f "$path" ] || { echo "  lipseste $path, sar peste"; return 0; }

  local sha content payload
  sha=$(api "https://api.github.com/repos/$GH_USER/$GH_REPO/contents/$name?ref=$BRANCH" \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))" 2>/dev/null || true)
  content=$(base64 -w0 < "$path" 2>/dev/null || base64 < "$path" | tr -d '\n')
  payload=$(python3 - "$name" "$content" "$sha" "$BRANCH" <<'PY'
import json,sys
name,content,sha,branch=sys.argv[1:5]
d={"message":"deploy "+name,"content":content,"branch":branch}
if sha: d["sha"]=sha
print(json.dumps(d))
PY
)
  echo "$payload" | api -X PUT -d @- \
    "https://api.github.com/repos/$GH_USER/$GH_REPO/contents/$name" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  urcat:', d['content']['path'] if 'content' in d else d.get('message','eroare'))"
}

echo "Deploy in https://github.com/$GH_USER/$GH_REPO ($BRANCH)"
if [ "${1:-}" = "--all" ]; then
  for f in index.html manifest.webmanifest sw.js icon-192.png icon-512.png icon-512-maskable.png apple-touch-icon.png; do
    push_file "$f"
  done
else
  push_file "${1:-index.html}" "index.html"
fi

echo
echo "Gata. In ~30 de secunde e live la:"
echo "  https://$GH_USER.github.io/$GH_REPO/"
echo "Pe telefon: inchizi aplicatia complet si o redeschizi, ca sa ia versiunea noua."
