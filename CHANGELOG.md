# Changelog

All notable product changes are tracked here.

## Unreleased

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
