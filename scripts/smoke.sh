#!/usr/bin/env bash
set -euo pipefail

cd /home/samyao/work/workscout
source /home/samyao/.nvm/nvm.sh
nvm use 24 >/dev/null

npm run build >/tmp/workscout-smoke-build.log 2>&1
npx wrangler dev --local --port 8787 >/tmp/workscout-smoke-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

READY=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 2 http://127.0.0.1:8787/api/health >/tmp/workscout-health.json 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "SERVER_NOT_READY"
  tail -80 /tmp/workscout-smoke-server.log
  exit 1
fi

echo "HEALTH:"
cat /tmp/workscout-health.json
echo

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

echo "POST_WORK:"
curl -fsS --max-time 10 -X POST   -H "content-type: application/json"   -H "X-Forwarded-For: smoke-$RANDOM-$$"   -d '{"title":"Smoke test remote task","company":"WorkScout QA","description":"A real end to end smoke test task for the community posting flow.","skills":"SmokeSkillOct2026, React","workType":"Contract","locationScope":"Worldwide","budget":"NZD 100 fixed","contact":"qa@example.com","website":""}'   http://127.0.0.1:8787/api/posts >/tmp/workscout-post.json
cat /tmp/workscout-post.json
echo

echo "COMMUNITY_SEARCH:"
curl -fsS --max-time 30 --get   --data-urlencode "q=SmokeSkillOct2026"   --data-urlencode "country=NZ"   --data-urlencode "hours=20"   --data-urlencode "types=contract,part-time,gig"   http://127.0.0.1:8787/api/search >/tmp/workscout-community.json

python3 - <<'PY'
import json
with open('/tmp/workscout-community.json') as f:
    d=json.load(f)
items=d.get('items',[])
community=[x for x in items if x.get('source')=='WorkScout']
print('community_matches=', [(x.get('title'), x.get('company'), x.get('applyUrl')) for x in community])
assert any(x.get('title')=='Smoke test remote task' for x in community)
PY

echo "HTML_ROOT:"
curl -fsS --max-time 5 http://127.0.0.1:8787/ | head -c 120
echo
echo "SMOKE_OK"
