# WorkScout

[![CI](https://github.com/yaohuangguan/work-scout/actions/workflows/ci.yml/badge.svg)](https://github.com/yaohuangguan/work-scout/actions/workflows/ci.yml) [![Live](https://img.shields.io/badge/live-WorkScout-266a49)](https://workscout.nzs.workers.dev)

**Find remote work you can actually take.**

WorkScout searches both traditional remote-job feeds and direct hiring leads, then ranks opportunities by skill match, location eligibility, flexibility, and freshness — without hiding the original source.

[Live app](https://workscout.nzs.workers.dev) · [Report a bug](https://github.com/yaohuangguan/work-scout/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/yaohuangguan/work-scout/issues/new?template=feature_request.yml)

![WorkScout home screen](docs/assets/workscout-home.png)

## Why WorkScout exists

Remote work is easy to search for and surprisingly hard to **actually qualify for**.

A listing may say “remote” but still require a specific country, timezone, employment status, or 40-hour schedule. Meanwhile, some of the best opportunities are not formal job listings at all — they are posts such as:

> Looking for someone to finish a Shopify checkout flow.

> Need a video editor for short-form content.

> Hiring a remote developer for a paid code review and launch work.

WorkScout treats all of these as **work opportunities**, not just job titles.

## What makes it different

| | Typical remote job board | WorkScout |
| --- | --- | --- |
| Formal job listings | Yes | Yes |
| Direct freelance / hiring leads | Usually no | Yes |
| Country eligibility surfaced early | Sometimes | Yes |
| Weekly availability considered | Rarely | Yes |
| Original source preserved | Varies | Always |
| “Why this matched” explanation | Rarely | Yes |
| Search by what you can do | Limited | Yes |
| Community work posting | Sometimes | Yes |

## Product v1

### Search across jobs and direct leads

Current discovery sources:

- **Reddit r/forhire** — only fresh `[Hiring]` posts
- **Hacker News freelancer threads** — only `SEEKING FREELANCER` comments
- **Himalayas**
- **Remote OK**
- **Remotive**
- **WorkScout community posts**

All source adapters normalize into the same `WorkItem` model before ranking and deduplication.

### Search in normal language

You can search for work like:

```text
Customer support, Chinese + English
Video editing for short-form content
React + Node, 20h/week
Excel / data entry evenings
AI automation + website maintenance
```

WorkScout expands the request into useful search terms, retrieves matching opportunities, and ranks them against your constraints.

### Eligibility before the click

Results surface:

- remote scope
- country / region restrictions
- contract, gig, part-time, or full-time signals
- freshness
- source
- salary / budget when available
- why the opportunity surfaced

The goal is to reduce the common “Remote — US only” dead end.

### Direct leads get their own treatment

Direct hiring posts are marked as **Lead** and can be filtered separately from normal jobs.

A lead is intentionally ranked differently from a generic job listing because it is often:

- more immediate
- more flexible
- closer to freelance / contract work
- easier to contact directly

### Save and revisit

The current version supports:

- saved opportunities
- recent searches
- source filters
- 7 / 30 day freshness filters
- “Looks eligible” filtering
- flexible-work filtering
- direct-lead filtering

Saved data stays on the device for now, so the product works without requiring an account.

### Post work

Anyone can publish a small piece of remote work into the WorkScout community pool.

The first release includes:

- direct email or application URL contact
- D1 persistence in the current public Worker
- SQLite persistence through `openmesh-node/db` in the OpenMesh backend preview
- honeypot bot protection
- per-connection posting throttling
- hashed fingerprints instead of raw IP storage
- automatic cleanup of old throttle records

## Architecture

The public deployment is still the original Cloudflare Worker + Hono + D1 stack while the next backend is being validated on OpenMesh.

### Current production

```text
React / Vite
    |
    v
Cloudflare Worker / Hono
    |
    +--> Reddit / HN / job APIs
    +--> Cloudflare D1
```

### OpenMesh backend preview

```text
React / Vite
    |
    | /api
    v
OpenMesh gateway :8787
    |
    +--> app.mesh("search") ------> search service :8791
    |                               + Reddit / HN / job APIs
    |                               + bounded TTL cache
    |
    +--> app.mesh("community") ---> community service :8792
                                    + openmesh-node/db
                                    + node:sqlite

OpenMesh control plane :8790
    + service registration
    + service discovery
    + live peer pools
```

The split follows real workload boundaries rather than creating microservices for presentation value: gateway owns the public API and result merge, search owns outbound discovery, and community owns posting, throttling, and persistence.

The React application keeps the same `/api/*` contract in both backends.

More detail:

- [Current production architecture](docs/ARCHITECTURE.md)
- [OpenMesh runtime migration](docs/openmesh-runtime.md)

## Why the core search does not require an LLM

The product intentionally keeps its critical path deterministic and inexpensive.

Today, WorkScout can search and rank without any model key. That means a model outage, quota problem, or billing issue does not break the basic product.

An optional LLM layer is a strong next step for:

- semantic query expansion
- unstructured lead classification
- ambiguous timezone / country interpretation
- better summaries
- scam and low-quality signals
- matching work to a richer user profile

The model should enhance discovery — not become the crawler.

## Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend preview:** OpenMesh gateway + search + community services
- **Service discovery:** OpenMesh control plane
- **Database preview:** `openmesh-node/db` + Node `node:sqlite`
- **Current production API:** Hono on Cloudflare Workers
- **Current production database:** Cloudflare D1
- **Testing:** Vitest + real OpenMesh topology test + end-to-end smoke script
- **CI:** GitHub Actions
- **Current production deployment:** Wrangler

## Run locally

Requirements:

- Node.js 24
- npm

```bash
git clone https://github.com/yaohuangguan/work-scout.git
cd work-scout

npm install
npm run dev
```

The default development command starts the OpenMesh backend plus Vite.

Then open:

- UI: `http://localhost:5173`
- OpenMesh gateway: `http://localhost:8787`
- control plane: `http://localhost:8790`
- search service: `http://localhost:8791`
- community service: `http://localhost:8792`

Vite keeps proxying `/api` to port 8787, so the frontend does not need a different API client.

To run the legacy Worker locally instead:

```bash
npm run dev:worker
```

The legacy Worker uses port 8788 on this branch so it can coexist with the OpenMesh gateway.

## Verify before changing main

```bash
npm run check
npm run smoke
```

`npm run check` runs:

1. TypeScript across UI, Worker, and OpenMesh server
2. existing source-adapter tests
3. a real OpenMesh topology integration test
4. frontend production build
5. Node API bundle

The topology test starts a real control plane, registers search/community services on random ports, verifies discovery, writes through SQLite, and exercises post/search/list traffic through the gateway.

The default smoke test additionally verifies:

- OpenMesh gateway health
- one discovered search peer and one discovered community peer
- live external search
- community publishing through `openmesh-node/db`
- immediate searchability of a new post
- public post listing does not expose contact data

The previous Worker smoke remains available as `npm run smoke:legacy`.

## Deploy

The public site is intentionally **not** switched to OpenMesh in this refactor.

`npm run deploy` continues deploying the current Cloudflare Worker + D1 backend:

```bash
npm run db:migrate:remote
npm run deploy
```

Current Cloudflare resources:

- Worker: `workscout`
- D1 database: `workscout-db`
- Production: https://workscout.nzs.workers.dev

The OpenMesh production cutover will happen separately after choosing the Node hosting target and production persistence backend. See [docs/openmesh-runtime.md](docs/openmesh-runtime.md).

## Repository structure

```text
.
├── src/                 # React frontend
├── server/              # OpenMesh gateway, services, DB adapter, topology test
├── worker/              # current Hono Worker + shared source adapters/ranking
├── scripts/             # OpenMesh + legacy end-to-end smoke verification
├── public/              # favicon and web manifest
├── docs/                # architecture, OpenMesh migration, product assets
├── .github/             # CI and contribution templates
├── schema.sql           # shared community schema
├── wrangler.jsonc       # current Worker + D1 + asset bindings
└── vite.config.ts
```

## Roadmap

The next valuable work is deeper discovery coverage rather than turning WorkScout into a heavy marketplace too early.

Near-term priorities:

- Greenhouse / Lever / Ashby discovery
- company career-page indexing
- more public freelance and hiring communities
- saved-search alerts
- optional LLM lead classifier
- better duplicate / stale-listing detection
- source trust and scam signals
- account sync only when cross-device state is worth the complexity

See [open issues](https://github.com/yaohuangguan/work-scout/issues) for active work.

## Contributing

Contributions are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. Small source adapters, ranking improvements, parser fixes, test coverage, and UX fixes are especially useful.

## Security

Please do not open a public issue for a vulnerability involving posting abuse, stored data, or Worker / D1 access.

See [SECURITY.md](SECURITY.md).

## License

No explicit open-source license has been selected yet. Until one is added, normal copyright rules apply.
