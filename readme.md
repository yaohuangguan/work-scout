# WorkScout

WorkScout is an MVP for finding remote work you can actually take, rather than browsing job titles.

## What works now

- Natural-language work search
- Search planning / keyword expansion
- Remote eligibility checks for the user's country
- Availability-aware ranking for contract, part-time, gig, and full-time work
- Live aggregation from Himalayas, Remote OK, and Remotive
- Unified deduped result model with source attribution
- Direct links back to original listings
- Community work posts stored in Cloudflare D1
- Direct poster contact via email or application URL
- React + TypeScript frontend and Cloudflare Worker backend
- Unit tests and an end-to-end smoke script

## Architecture

```
React + Vite
    |
    v
Cloudflare Worker /api
    |
    +--> Himalayas API
    +--> Remote OK API
    +--> Remotive API
    +--> Cloudflare D1 (WorkScout community posts)
    |
    v
Normalization -> eligibility -> scoring -> dedupe -> ranked WorkItem[]
```

The current search layer is intentionally deterministic. A future LLM adapter can improve query planning, lead classification, summarization, and ambiguous eligibility checks without making the basic product depend on a paid model.

## Run locally

```bash
source ~/.nvm/nvm.sh
nvm use 24
npm install
npm run db:migrate:local
npm run dev
```

UI: http://localhost:5173

Worker API: http://localhost:8787

## Verify

```bash
npm run check
./scripts/smoke.sh
```

The smoke test verifies health, live external search, D1 posting, searching the newly posted community work, contact-link generation, and static asset serving.

## Deploy

```bash
npm run db:migrate:remote
npm run deploy
```

Current deployment: https://workscout.nzs.workers.dev

## Data sources

External listings remain owned and hosted by their original sources. WorkScout links users back to the original listing and visibly attributes the source.

- Himalayas: https://himalayas.app
- Remote OK: https://remoteok.com
- Remotive: https://remotive.com

## Next product layer

The next useful step is not adding more UI. It is expanding from job-board feeds into real work leads: company career pages / ATS, public community posts, startup hiring signals, Reddit/HN-style requests, freshness checks, and an optional LLM classification layer for unstructured leads.
