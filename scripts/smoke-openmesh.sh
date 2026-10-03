#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f /home/samyao/.nvm/nvm.sh ]; then
  # shellcheck disable=SC1091
  source /home/samyao/.nvm/nvm.sh
  nvm use 24 >/dev/null
fi

TMP_DIR="$(mktemp -d)"
export WORKSCOUT_DB_PATH="$TMP_DIR/workscout.sqlite"
export WORKSCOUT_EXTERNAL_SEARCH="${WORKSCOUT_EXTERNAL_SEARCH:-true}"
export WORKSCOUT_GATEWAY_PORT="${WORKSCOUT_GATEWAY_PORT:-8787}"
export WORKSCOUT_CONTROL_PORT="${WORKSCOUT_CONTROL_PORT:-8790}"
export WORKSCOUT_SEARCH_PORT="${WORKSCOUT_SEARCH_PORT:-8791}"
export WORKSCOUT_COMMUNITY_PORT="${WORKSCOUT_COMMUNITY_PORT:-8792}"

LOG_FILE="${TMPDIR:-/tmp}/workscout-openmesh-smoke.log"

npm run build >/tmp/workscout-openmesh-build.log 2>&1
node dist-server/index.mjs >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BASE="http://127.0.0.1:${WORKSCOUT_GATEWAY_PORT}"
READY=0
for _ in $(seq 1 40); do
  if curl -fsS --max-time 2 "$BASE/api/health" >/tmp/workscout-openmesh-health.json 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.25
done

if [ "$READY" -ne 1 ]; then
  echo "OPENMESH_SERVER_NOT_READY"
  tail -120 "$LOG_FILE"
  exit 1
fi

echo "HEALTH:"
cat /tmp/workscout-openmesh-health.json
echo

python3 - <<'PY'
import json
with open('/tmp/workscout-openmesh-health.json') as f:
    d=json.load(f)
assert d.get('runtime') == 'openmesh'
assert d.get('services', {}).get('search', {}).get('peers') == 1
assert d.get('services', {}).get('community', {}).get('peers') == 1
PY

NEEDLE="SmokeSkillOpenMesh$(date +%s)$$"

echo "POST_WORK:"
curl -fsS --max-time 10 -X POST \
  -H "content-type: application/json" \
  -H "X-Forwarded-For: smoke-$RANDOM-$$" \
  -d "{\"title\":\"OpenMesh smoke test remote task\",\"company\":\"WorkScout QA\",\"description\":\"A real end to end OpenMesh smoke test task for the community posting flow.\",\"skills\":\"$NEEDLE, React\",\"workType\":\"Contract\",\"locationScope\":\"Worldwide\",\"budget\":\"NZD 100 fixed\",\"contact\":\"qa@example.com\",\"website\":\"\"}" \
  "$BASE/api/posts" >/tmp/workscout-openmesh-post.json
cat /tmp/workscout-openmesh-post.json
echo

echo "SEARCH:"
curl -fsS --max-time 35 --get \
  --data-urlencode "q=$NEEDLE" \
  --data-urlencode "country=NZ" \
  --data-urlencode "countryLabel=New Zealand" \
  --data-urlencode "hours=20" \
  --data-urlencode "types=contract,part-time,gig" \
  "$BASE/api/search" >/tmp/workscout-openmesh-search.json

NEEDLE="$NEEDLE" python3 - <<'PY'
import json, os
with open('/tmp/workscout-openmesh-search.json') as f:
    d=json.load(f)
sources=d.get('sources', [])
items=d.get('items', [])
print('count=', d.get('count'))
print('sources=', [(x.get('name'), x.get('ok'), x.get('count')) for x in sources])
print('community=', [(x.get('title'), x.get('company')) for x in items if x.get('source') == 'WorkScout'])
assert len(sources) == 6
assert any(x.get('name') == 'HN Freelance' for x in sources)
assert any(os.environ['NEEDLE'].lower() in ' '.join(x.get('tags', [])).lower() for x in items if x.get('source') == 'WorkScout')
PY

echo "POSTS:"
curl -fsS --max-time 5 "$BASE/api/posts" >/tmp/workscout-openmesh-posts.json
python3 - <<'PY'
import json
with open('/tmp/workscout-openmesh-posts.json') as f:
    d=json.load(f)
assert d.get('items')
assert all('contact' not in item for item in d['items'])
print('posts=', len(d['items']))
PY

echo "OPENMESH_SMOKE_OK"
