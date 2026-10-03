# WorkScout on OpenMesh

WorkScout now has a second backend implementation built on `openmesh-node`.

The current public Cloudflare Worker remains available during migration. Local development defaults to the OpenMesh backend.

## Topology

```text
React / Vite
    |
    | /api
    v
OpenMesh gateway :8787
    |
    +------ app.mesh("search") ------> search service :8791
    |                                  |
    |                                  +--> Reddit r/forhire
    |                                  +--> HN Freelance
    |                                  +--> Himalayas
    |                                  +--> Remote OK
    |                                  +--> Remotive
    |
    +---- app.mesh("community") -----> community service :8792
                                       |
                                       +--> openmesh-node/db
                                       +--> node:sqlite
                                       +--> schema.sql

OpenMesh control plane :8790
    |
    +--> search registration + watch
    +--> community registration + watch
```

## Why these service boundaries

The split follows real workload differences rather than creating microservices for presentation value.

- **gateway** owns the public API contract, request validation, CORS, source merging and graceful degradation.
- **search** owns outbound remote-work discovery. It has tighter concurrency limits and a bounded in-memory TTL cache to avoid repeatedly hitting upstream sources.
- **community** owns posting, rate limits and persistence. It is the only service that knows the database implementation.
- **control** owns service registration and discovery.

The React application keeps the same `/api/*` contract, so the UI does not care which backend implementation is active.

## OpenMesh features exercised by real product traffic

This is intentionally a real consumer of OpenMesh 0.5 rather than a framework demo.

- typed GET/POST routes and Standard Schema validation
- body parsing
- global middleware and error handling
- `app.mesh("service")`
- service registration
- service discovery and live peer pools
- per-service concurrency / queue limits
- retries and circuit state
- request-context propagation
- graceful startup and shutdown
- `openmesh-node/db` lifecycle and health
- typed transaction adapter
- packed OpenMesh dependency from the 0.5 preview branch

## Database boundary

The community service currently uses Node's built-in `node:sqlite` so the OpenMesh backend is self-contained locally and does not need another database dependency.

The business routes do not depend on SQLite directly:

```text
community route
    -> database resource
        -> CommunityDatabase
            -> node:sqlite
```

That boundary is intentional. A later production migration can replace `CommunityDatabase` with Prisma, Drizzle, Kysely, TypeORM, a Postgres client or another adapter without changing the gateway or public API.

The original Cloudflare deployment still uses D1 through the legacy Worker.

## Local development

```bash
source ~/.nvm/nvm.sh
nvm use 24

npm install
npm run dev
```

Default ports:

- UI: http://localhost:5173
- gateway: http://localhost:8787
- control plane: http://localhost:8790
- search service: http://localhost:8791
- community service: http://localhost:8792

Vite still proxies `/api` to port 8787, so no frontend API-base changes are required.

To run the old Worker locally instead:

```bash
npm run dev:worker
```

The legacy Worker uses port 8788 in this branch so it can coexist with the OpenMesh gateway.

## Verification

```bash
npm run check
npm run smoke
```

`npm run check` includes:

- TypeScript for UI, Worker and OpenMesh server
- existing source-adapter tests
- a real OpenMesh topology integration test using random ports
- service registration/discovery assertions
- real SQLite persistence
- gateway posting/search/listing flow
- frontend production build
- Node API bundle

`npm run smoke` builds the production artifacts, starts the bundled OpenMesh topology, performs a real external search, posts a community item and verifies that the gateway merges it with the external source responses.

## Production migration

The public deployment is intentionally not switched in the same change.

Current production:

```text
Cloudflare Worker / Hono
    + D1
```

OpenMesh target:

```text
Cloudflare/static frontend
    -> Node-hosted OpenMesh gateway
        -> OpenMesh search service
        -> OpenMesh community service
            -> production database
```

The next production step is to choose the Node hosting target and production persistence backend, then route `/api/*` to the OpenMesh gateway. Until that cutover, `npm run deploy` continues deploying the existing Worker safely.
