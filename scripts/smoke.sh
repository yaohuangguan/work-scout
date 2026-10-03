#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f /home/samyao/.nvm/nvm.sh ]; then
  # Local WSL convenience. GitHub Actions already provides Node 24.
  # shellcheck disable=SC1091
  source /home/samyao/.nvm/nvm.sh
  nvm use 24 >/dev/null
fi

STATE_DIR="$(mktemp -d)"

npm run build >/tmp/workscout-smoke-build.log 2>&1
./node_modules/.bin/wrangler d1 execute workscout-db \
  --local \
  --persist-to "$STATE_DIR" \
  --file=./schema.sql \
  >/tmp/workscout-smoke-migrate.log 2>&1

./node_modules/.bin/wrangler dev --local --port 8787 \
  --persist-to "$STATE_DIR" \
  --var "WORKSCOUT_EXTERNAL_SEARCH:${WORKSCOUT_EXTERNAL_SEARCH:-true}" \
  >/tmp/workscout-smoke-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  pkill -P "$SERVER_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$STATE_DIR"
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8787/api/health >/tmp/workscout-health.json 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.4
done

if [ "$READY" -ne 1 ]; then
  echo "SERVER_NOT_READY"
  tail -120 /tmp/workscout-smoke-server.log
  exit 1
fi

echo "HEALTH:"
cat /tmp/workscout-health.json
echo

python3 - <<'PY'
import json
with open('/tmp/workscout-health.json') as f:
    d=json.load(f)
assert d.get('runtime') == 'openmesh-worker'
assert d.get('database') == 'ready'
PY

echo "EXTERNAL_SEARCH:"
curl -fsS --max-time 30 --get   --data-urlencode "q=React Node"   --data-urlencode "country=NZ"   --data-urlencode "countryLabel=New Zealand"   --data-urlencode "hours=20"   --data-urlencode "types=contract,part-time,gig"   http://127.0.0.1:8787/api/search >/tmp/workscout-search.json

python3 - <<'PY'
import json
with open('/tmp/workscout-search.json') as f:
    d=json.load(f)
print('count=', d.get('count'))
print('sources=', [(x.get('name'), x.get('ok'), x.get('count')) for x in d.get('sources',[])])
print('top=', [(x.get('source'), x.get('title'), x.get('score')) for x in d.get('items',[])[:3]])
assert 'items' in d
assert len(d.get('sources', [])) == 6
assert any(x.get('name') == 'HN Freelance' for x in d.get('sources', []))
PY

NEEDLE="SmokeSkillOpenMeshWorker$(date +%s)$$"
TITLE="OpenMesh Worker smoke $NEEDLE"
export NEEDLE TITLE

python3 - <<'PY'
import json, os
payload = {
  "title": os.environ["TITLE"],
  "company": "WorkScout QA",
  "description": "A real end to end OpenMesh Cloudflare Worker smoke test task for the community posting flow.",
  "skills": os.environ["NEEDLE"] + ", React",
  "workType": "Contract",
  "locationScope": "Worldwide",
  "budget": "NZD 100 fixed",
  "contact": "qa@example.com",
  "website": ""
}
with open('/tmp/workscout-post-payload.json', 'w') as f:
    json.dump(payload, f)
PY

echo "POST_WORK:"
curl -fsS --max-time 10 -X POST   -H "content-type: application/json"   -H "X-Forwarded-For: smoke-$RANDOM-$$"   --data-binary @/tmp/workscout-post-payload.json   http://127.0.0.1:8787/api/posts >/tmp/workscout-post.json
cat /tmp/workscout-post.json
echo

echo "COMMUNITY_SEARCH:"
curl -fsS --max-time 30 --get   --data-urlencode "q=$NEEDLE"   --data-urlencode "country=NZ"   --data-urlencode "countryLabel=New Zealand"   --data-urlencode "hours=20"   --data-urlencode "types=contract,part-time,gig"   http://127.0.0.1:8787/api/search >/tmp/workscout-community.json

python3 - <<'PY'
import json, os
with open('/tmp/workscout-community.json') as f:
    d=json.load(f)
items=d.get('items',[])
community=[x for x in items if x.get('source')=='WorkScout']
print('community_matches=', [(x.get('title'), x.get('company'), x.get('applyUrl')) for x in community])
assert any(x.get('title') == os.environ['TITLE'] for x in community)
PY

echo "POSTS:"
curl -fsS --max-time 5 http://127.0.0.1:8787/api/posts >/tmp/workscout-posts.json
python3 - <<'PY'
import json
with open('/tmp/workscout-posts.json') as f:
    d=json.load(f)
assert d.get('items')
assert all('contact' not in item for item in d['items'])
print('posts=', len(d['items']))
PY

echo "HTML_ROOT:"
curl -fsS --max-time 5 http://127.0.0.1:8787/ | head -c 120
echo
echo "OPENMESH_WORKER_SMOKE_OK"
