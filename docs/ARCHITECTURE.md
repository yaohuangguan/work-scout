# WorkScout architecture

WorkScout is intentionally small: one React frontend, one Cloudflare Worker, one D1 database, and independent source adapters.

The architecture is designed so new discovery sources can be added without changing the UI contract.

## Request flow

```text
User description
    |
    v
SearchPreferences
    |
    v
planQuery()
    |
    +--> Reddit r/forhire adapter
    +--> HN freelancer adapter
    +--> Himalayas adapter
    +--> Remote OK adapter
    +--> Remotive adapter
    +--> WorkScout D1 posts
    |
    v
WorkItem normalization
    |
    v
eligibility inference
    |
    v
scoreWork()
    |
    v
cross-source dedupe
    |
    v
ranked WorkItem[]
```

## Core model

Every external or community opportunity becomes a `WorkItem`.

Important fields include:

- `title`
- `company`
- `summary`
- `source`
- `sourceUrl`
- `applyUrl`
- `postedAt`
- `type`
- `location`
- `salary`
- `tags`
- `eligibility`
- `eligibilityText`
- `score`
- `why`
- `kind`

The frontend should not need source-specific rendering logic beyond useful presentation differences such as highlighting `Lead`.

## Source adapters

Source adapters live in `worker/search.ts`.

Each adapter should:

1. fetch from a public / permitted source
2. parse only the minimum data needed
3. normalize into `WorkItem`
4. preserve the original URL
5. avoid pretending uncertain location data is definitive
6. fail independently so one source cannot break the whole search

External requests use short Cloudflare cache TTLs to reduce repeated upstream traffic.

## Query planning

`planQuery()` currently combines:

- deterministic skill expansions
- English token extraction
- duplicate removal
- a capped query list

This keeps the baseline fast and model-free.

A future semantic planner can sit in front of the same adapter layer as long as it returns the same query-plan contract.

## Eligibility

Eligibility is deliberately expressed as one of:

- `eligible`
- `uncertain`
- `restricted`

WorkScout should prefer an honest `uncertain` over a confident but incorrect answer.

Country / region inference is intentionally conservative. Any future LLM-based interpretation should preserve this three-state behavior.

## Ranking

Current scoring considers:

- matched search terms
- eligibility
- requested work types
- weekly availability
- freshness
- direct-lead status

Direct leads receive a boost because they are often more immediate and flexible than generic remote listings.

Scores are product-ranking signals, not claims that a user is guaranteed to qualify for or obtain the work.

## Deduplication

Deduplication happens twice:

1. inside external-source aggregation
2. again after community posts and external results are merged

The current key uses normalized company + title and keeps the stronger ranked item.

This should evolve toward richer canonicalization when more ATS / company sources are added.

## Community posts

Community work is stored in Cloudflare D1.

Posting protection currently includes:

- input length validation
- contact validation
- a hidden honeypot
- per-connection throttling
- SHA-256 fingerprints rather than raw IP storage
- automatic cleanup of old throttle records

The community system is intentionally minimal and does not yet implement user accounts, messaging, payments, or reputation.

## Frontend state

Saved opportunities and recent searches are stored in local storage.

This keeps the first product useful without authentication.

Account sync should only be introduced when cross-device state provides enough value to justify identity, privacy, migration, and account-recovery complexity.

## Failure behavior

Search sources are isolated with independent error handling.

The API returns source health alongside results so the UI can show when one source is temporarily unavailable while still presenting results from the others.

## Testing

`npm run check` verifies:

- TypeScript
- unit tests
- production build

`npm run smoke` verifies the end-to-end local Worker path including:

- health
- live source retrieval
- D1 writes
- community post searchability
- SPA assets

GitHub Actions runs the deterministic check suite for pushes and pull requests.
