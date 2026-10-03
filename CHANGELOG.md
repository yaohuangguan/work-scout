# Changelog

All notable product changes are tracked here.

## Unreleased

### Added

- SEO/AI-discovery foundation with static landing pages and practical guides
- unique canonical/title/description/social metadata per indexable page
- sitemap.xml, robots.txt, llms.txt, PNG search favicon, and social preview image
- WebSite/Organization/WebPage/Article/Breadcrumb structured data
- crawlable homepage fallback content and internal resource links
- true 404 handling instead of SPA soft-404s
- API X-Robots-Tag noindex headers
- SEO regression tests and build-time page generation
- Scout Watch: persist a search and re-run it through an hourly Cloudflare scheduler once the watch has been due for at least 6 hours
- baseline-aware watch matching so only newly discovered opportunities are marked new
- anonymous watch ownership using a random browser key with only its SHA-256 hash stored server-side
- stricter watch candidate filtering that requires explicit keyword-match evidence
- Apply Pipeline with Saved, Contacted, Applied, Interview, Offer, and Closed stages
- D1-backed pipeline persistence and a lightweight kanban UI
- end-to-end smoke coverage for watch baselines, new matches, and pipeline persistence
- unit coverage for watch preference reconstruction and candidate filtering

### Changed

- replaced the Hono API runtime with OpenMesh 0.5 inside the existing Cloudflare Worker
- kept Cloudflare D1 and static ASSETS bindings unchanged
- added typed OpenMesh request validation, body parsing, middleware, and error handling
- registered the D1 binding through `openmesh-node/db`
- bridged Worker requests into OpenMesh through Cloudflare's `node:http` compatibility and `cloudflare:node`
- added Wrangler runtime type generation to TypeScript verification
- kept the existing `/api/*` contract and deployment path
- preserved honeypot behavior under typed validation
- made smoke verification deterministic in CI by allowing external sources to be disabled
- added a real OpenMesh control-plane/service-discovery integration test covering registration, `app.mesh()`, traffic targeting, and request-context propagation

## [0.1.0] - 2026-10-03

First public product release.

### Added

- natural-language remote-work discovery
- Himalayas, Remote OK, and Remotive source adapters
- Reddit `r/forhire` direct hiring leads
- Hacker News `SEEKING FREELANCER` lead discovery
- unified `WorkItem` normalization
- country-aware eligibility states
- flexibility and weekly-availability ranking
- freshness scoring
- direct-lead ranking boost
- cross-source deduplication
- source health visibility
- Explore and Saved views
- on-device saved opportunities
- on-device recent searches
- source, freshness, eligibility, and direct-lead filters
- opportunity detail view
- D1-backed community work posting
- direct email / application URL contact
- honeypot and hashed posting throttle
- automatic country detection through Cloudflare
- favicon, web manifest, metadata, and responsive product UI
- Vitest coverage
- end-to-end smoke verification
- GitHub Actions CI

### Infrastructure

- Cloudflare Workers
- Cloudflare D1
- Hono API
- React 19 + TypeScript + Vite

### Live

https://workscout.nzs.workers.dev
