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

CLIENT_KEY="smoke-client-$NEEDLE"
export CLIENT_KEY

python3 - <<'PY'
import json, os
watch = {
  "label": "Smoke watch",
  "query": os.environ["NEEDLE"],
  "country": "NZ",
  "countryLabel": "New Zealand",
  "hours": 20,
  "types": ["contract", "part-time", "gig"]
}
with open('/tmp/workscout-watch-payload.json', 'w') as f:
    json.dump(watch, f)

with open('/tmp/workscout-community.json') as f:
    search=json.load(f)
item=next(x for x in search["items"] if x.get("source") == "WorkScout")
with open('/tmp/workscout-pipeline-payload.json', 'w') as f:
    json.dump({"item": item, "status": "applied", "notes": "Smoke pipeline"}, f)
PY

echo "CREATE_WATCH:"
curl -fsS --max-time 30 -X POST \
  -H "content-type: application/json" \
  -H "x-workscout-client: $CLIENT_KEY" \
  --data-binary @/tmp/workscout-watch-payload.json \
  http://127.0.0.1:8787/api/watches >/tmp/workscout-watch.json
cat /tmp/workscout-watch.json
echo

WATCH_ID="$(python3 -c 'import json; print(json.load(open("/tmp/workscout-watch.json"))["id"])')"

SECOND_TITLE="Second OpenMesh Watch smoke $NEEDLE"
export SECOND_TITLE
python3 - <<'PY'
import json, os
payload = {
  "title": os.environ["SECOND_TITLE"],
  "company": "WorkScout QA",
  "description": "A second deterministic opportunity created after the Scout Watch baseline.",
  "skills": os.environ["NEEDLE"] + ", React",
  "workType": "Contract",
  "locationScope": "Worldwide",
  "budget": "NZD 120 fixed",
  "contact": "qa@example.com",
  "website": ""
}
with open('/tmp/workscout-second-post.json', 'w') as f:
    json.dump(payload, f)
PY

curl -fsS --max-time 10 -X POST \
  -H "content-type: application/json" \
  -H "X-Forwarded-For: watch-smoke-$RANDOM-$$" \
  --data-binary @/tmp/workscout-second-post.json \
  http://127.0.0.1:8787/api/posts >/tmp/workscout-second-post-result.json

echo "RUN_WATCH:"
curl -fsS --max-time 30 -X POST \
  -H "x-workscout-client: $CLIENT_KEY" \
  "http://127.0.0.1:8787/api/watches/$WATCH_ID/run" >/tmp/workscout-watch-run.json
cat /tmp/workscout-watch-run.json
echo

curl -fsS --max-time 10 \
  -H "x-workscout-client: $CLIENT_KEY" \
  "http://127.0.0.1:8787/api/watches/$WATCH_ID/matches" >/tmp/workscout-watch-matches.json

python3 - <<'PY'
import json, os
d=json.load(open('/tmp/workscout-watch-matches.json'))
matches=d.get('items', [])
print('watch_matches=', [(x['item']['title'], x['isNew']) for x in matches])
assert any(x['item']['title'] == os.environ['SECOND_TITLE'] and x['isNew'] for x in matches)
PY

echo "PIPELINE:"
curl -fsS --max-time 10 -X POST \
  -H "content-type: application/json" \
  -H "x-workscout-client: $CLIENT_KEY" \
  --data-binary @/tmp/workscout-pipeline-payload.json \
  http://127.0.0.1:8787/api/pipeline >/tmp/workscout-pipeline-upsert.json

curl -fsS --max-time 10 \
  -H "x-workscout-client: $CLIENT_KEY" \
  http://127.0.0.1:8787/api/pipeline >/tmp/workscout-pipeline.json

python3 - <<'PY'
import json
d=json.load(open('/tmp/workscout-pipeline.json'))
items=d.get('items', [])
print('pipeline=', [(x['item']['title'], x['status']) for x in items])
assert any(x['status'] == 'applied' for x in items)
PY

echo "HTML_ROOT:"
curl -fsS --max-time 5 http://127.0.0.1:8787/ | head -c 120
echo
echo "OPENMESH_WORKER_SCOUT_WATCH_PIPELINE_SMOKE_OK"
