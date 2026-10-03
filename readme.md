# WorkScout

WorkScout helps people find remote work they can actually take.

Instead of acting like another job board, it combines structured remote-job feeds with direct hiring leads, normalizes them into one model, checks location restrictions and flexibility, then explains why each opportunity surfaced.

Live: https://workscout.nzs.workers.dev

## Product v1

### Discovery
- Natural-language skill search
- Query expansion for software, support, data entry, video editing, design, writing, sales, marketing, VA work, website maintenance, and more
- Country-aware eligibility checks
- Weekly-availability-aware ranking
- Contract / part-time / gig / full-time preferences
- Freshness and source filters
- Cross-source deduplication

### Sources
- Reddit r/forhire — only fresh `[Hiring]` posts are ingested as direct leads
- Hacker News “Freelancer? Seeking freelancer?” — only `SEEKING FREELANCER` comments
- Himalayas
- Remote OK
- Remotive
- WorkScout community posts

All external results keep clear source attribution and link back to the original page.

### Product experience
- Explore and Saved views
- Local saved-opportunity shortlist
- Recent searches stored on-device
- Result detail modal
- Direct-lead highlighting
- Search-plan and source-health visibility
- Location / freshness / source filtering
- Automatic country detection through Cloudflare when supported
- Responsive light UI with readable type sizes
- Post-work flow backed by D1

### Safety / abuse controls
- Strict post validation
- HTTP(S) / email-only contact validation
- Honeypot field
- Hashed per-connection posting throttle
- No raw IP addresses stored
- Old throttle events are automatically cleaned up
- React output escaping for community content

## Architecture

```text
React + Vite + TypeScript
          |
          v
Cloudflare Worker / Hono
          |
          +--> Reddit r/forhire Atom feed
          +--> HN Algolia API
          +--> Himalayas API
          +--> Remote OK API
          +--> Remotive API
          +--> Cloudflare D1
          |
          v
query planning
 -> source adapters
 -> normalization
 -> eligibility
 -> ranking
 -> cross-source dedupe
 -> WorkItem[]
```

External HTTP requests use short Cloudflare cache TTLs so normal searches do not continuously hammer upstream sources.

## Why no required LLM yet?

The first product intentionally keeps its critical path deterministic and cheap.

A future LLM layer can improve:
- free-form query expansion
- unstructured lead classification
- ambiguous country / timezone interpretation
- semantic matching
- summarization
- scam / low-quality signals

But basic discovery continues working if no model key exists.

## Local development

```bash
source ~/.nvm/nvm.sh
nvm use 24

npm install
npm run db:migrate:local
npm run dev
```

UI: http://localhost:5173

Worker API: http://localhost:8787

## Verification

```bash
npm run check
npm run smoke
```

`npm run check` runs TypeScript, Vitest, and the production Vite build.

The smoke test verifies:
- Worker health
- all configured discovery sources
- live external search
- D1 community publishing
- immediate searchability of the published work
- contact-link generation
- SPA asset serving

## Deploy

```bash
npm run db:migrate:remote
npm run deploy
```

Cloudflare resources:
- Worker: `workscout`
- D1: `workscout-db`

## Repository

https://github.com/yaohuangguan/work-scout

## Near-term roadmap

The next step should deepen lead coverage instead of adding generic marketplace features:
- more public freelance / hiring communities
- ATS discovery (Greenhouse / Lever / Ashby)
- company career-page indexing
- saved-search alerts
- optional LLM lead classifier
- account sync only when cross-device saved searches become necessary
