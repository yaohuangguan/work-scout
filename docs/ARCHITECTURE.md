# WorkScout architecture

WorkScout runs as a single Cloudflare Worker with static assets and D1 bindings.

OpenMesh 0.5 is the HTTP application runtime inside that Worker. Cloudflare's Node.js compatibility layer exposes `node:http`, and `cloudflare:node` bridges Worker `fetch()` requests into the OpenMesh Node-style request listener.

## Request flow

```text
Browser
  |
  | GET /, assets
  |------------------------------> ASSETS binding
  |
  | /api/*
  v
Cloudflare Worker fetch()
  |
  | handleAsNodeRequest()
  v
OpenMesh HTTP runtime
  |
  +--> typed routes / validation
  +--> middleware / CORS
  +--> body parser
  +--> error handler
  |
  +--> searchExternal()
  |      + Reddit r/forhire
  |      + HN freelancer
  |      + Himalayas
  |      + Remote OK
  |      + Remotive
  |
  +--> openmesh-node/db
         |
         v
       D1 binding
```

There is no separate Node server, container, VM, or Postgres requirement in the current architecture.

## Why OpenMesh can run in Workers

For the current Worker compatibility date, Cloudflare provides Node.js compatibility including `node:http` server APIs.

WorkScout creates one virtual Node HTTP server:

```ts
const server = createServer((req, res) => {
  listener?.(req, res);
});

server.listen(8787);
```

The port is a Worker-local routing key rather than a traditional TCP listener.

The Worker entrypoint routes API requests into that server:

```ts
return handleAsNodeRequest(8787, request, env, ctx);
```

OpenMesh plugin boot is lazy. `app.ready()` is first executed inside a Worker request context because Cloudflare correctly forbids timers and asynchronous I/O from global scope.

## Database integration

The D1 binding is registered as an OpenMesh database resource:

```ts
const db = database(env.DB, {
  name: "workscout-d1",
});

app.register(db);
```

OpenMesh does not wrap D1's query API. Routes still use the native binding:

```ts
await db.client
  .prepare("SELECT ...")
  .bind(...)
  .all();
```

This is the same integration philosophy used for Prisma, Drizzle, Kysely, TypeORM and other clients: OpenMesh owns application lifecycle and health semantics, while the database library keeps its own API.

## Core search model

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

The frontend does not need source-specific rendering logic beyond useful presentation differences such as highlighting direct leads.

## Source adapters

Source adapters live in `worker/search.ts`.

Each adapter should:

1. fetch from a public / permitted source
2. parse only the minimum data needed
3. normalize into `WorkItem`
4. preserve the original URL
5. avoid pretending uncertain location data is definitive
6. fail independently so one source cannot break the whole search

External requests use Cloudflare cache TTL hints to reduce repeated upstream traffic.

## Community posts

Community work is stored in Cloudflare D1.

Posting protection includes:

- typed request validation
- contact validation
- a hidden honeypot
- per-connection throttling
- SHA-256 fingerprints rather than raw IP storage
- cleanup of old throttle records
- React output escaping

## Failure behavior

External search sources are isolated with independent error handling.

The API returns source health alongside results, so one failing source does not take down the entire search.

OpenMesh's error handler keeps public API errors in the existing `{ error }` shape expected by the React frontend.

## Worker lifecycle

The OpenMesh app is configured in global scope but is not booted there.

On the first `/api/*` request:

1. `app.ready()` runs inside request context
2. plugins finish booting
3. the OpenMesh listener is cached
4. `handleAsNodeRequest()` dispatches the request

Later requests reuse the ready application and virtual server.

Static asset requests bypass OpenMesh and continue directly through the `ASSETS` binding.

## Verification

`npm run typecheck` regenerates Worker runtime types with Wrangler before TypeScript validation.

`npm run check` verifies:

- Cloudflare Worker runtime types
- TypeScript
- source adapter tests
- a real OpenMesh control-plane/service-discovery path with service registration, `app.mesh()`, traffic targeting, and request-context propagation
- frontend production build

`npm run smoke` starts the real local Wrangler runtime and verifies:

- OpenMesh Worker health
- D1 readiness
- live external search
- community posting
- immediate community searchability
- safe public post listing
- SPA assets

## Future service split

WorkScout does not need to be split into multiple Workers yet.

When a real scaling or ownership boundary appears, Cloudflare Service Bindings are the preferred transport between Workers. OpenMesh service discovery can then be integrated with a durable registry adapter rather than pretending isolate-local memory is a distributed control plane.
