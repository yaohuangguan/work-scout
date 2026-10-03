import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import openmesh, { HttpError, created, reply } from "openmesh-node";
import { database } from "openmesh-node/db";
import { bodyParser } from "openmesh-node/plugins";
import { type SearchPreferences } from "./search";
import {
  EXTERNAL_SOURCES,
  createWatch,
  deletePipeline,
  deleteWatch,
  getWatch,
  listPipeline,
  listWatchMatches,
  listWatches,
  markWatchViewed,
  refreshDueWatches,
  refreshWatch,
  searchAll,
  upsertPipeline,
} from "./productivity";
import {
  PipelineStatusSchema,
  PostInputSchema,
  SearchQuerySchema,
  WatchInputSchema,
  objectSchema,
} from "./contracts";

const OPENMESH_PORT = 8787;

type RuntimeEnv = Env & {
  WORKSCOUT_EXTERNAL_SEARCH?: string;
};

type OpenMeshApp = ReturnType<typeof openmesh>;
type OpenMeshListener = ReturnType<OpenMeshApp["callback"]>;

function externalSearchEnabled(workerEnv: RuntimeEnv) {
  const value = String(
    workerEnv.WORKSCOUT_EXTERNAL_SEARCH ?? "true",
  ).toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

function createRuntime(workerEnv: RuntimeEnv) {
  const db = database(workerEnv.DB, {
    name: "workscout-d1",
  });

  const app = openmesh()
    .use(bodyParser())
    .register(db);

  app.use(async (ctx, next) => {
    ctx.set("access-control-allow-origin", "*");
    ctx.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    ctx.set(
      "access-control-allow-headers",
      "content-type,x-workscout-client",
    );

    const cf = (ctx.req as typeof ctx.req & {
      cloudflare?: { cf?: { country?: string } };
    }).cloudflare?.cf;

    ctx.state.country = String(cf?.country || "").toUpperCase();

    const forwarded = String(
      ctx.get("cf-connecting-ip")
        || ctx.get("x-forwarded-for")
        || "local",
    );
    ctx.state.clientAddress = forwarded.split(",")[0]?.trim() || "local";

    const clientKey = String(ctx.get("x-workscout-client") || "").trim();
    ctx.state.clientHash = clientKey.length >= 16 && clientKey.length <= 160
      ? await fingerprintFor(`workscout:client:${clientKey}`)
      : null;

    if (ctx.method === "OPTIONS") {
      ctx.status = 204;
      return;
    }

    await next();
  });

  app.setErrorHandler((error, ctx) => {
    if (error instanceof HttpError) {
      ctx.status = error.statusCode;
      return {
        error: error.expose ? error.message : "Request failed.",
      };
    }

    console.error(error);
    ctx.status = 500;
    return { error: "Internal server error." };
  });

  function communityDb() {
    return db.client;
  }

  function requireClientHash(state: Record<string, unknown>) {
    const clientHash = typeof state.clientHash === "string"
      ? state.clientHash
      : "";
    if (!clientHash) {
      throw new HttpError(400, "A WorkScout client key is required.");
    }
    return clientHash;
  }

  app.get("/api/health", {
    response: objectSchema<Record<string, unknown>>("health response"),
  }, async () => ({
    ok: await db.healthy(),
    service: "workscout",
    runtime: "openmesh-worker",
    database: db.state,
    now: new Date().toISOString(),
    sources: [
      ...EXTERNAL_SOURCES,
      "WorkScout Community",
    ],
  }));

  app.get("/api/meta", {
    response: objectSchema<{ country: string }>("metadata response"),
  }, async ({ state }) => {
    const detected = typeof state.country === "string" ? state.country : "";
    const supported = new Set(["NZ", "AU", "US", "CA", "GB"]);
    return { country: supported.has(detected) ? detected : "ANY" };
  });

  app.get("/api/search", {
    query: SearchQuerySchema,
    response: objectSchema<Record<string, unknown>>("search response"),
  }, async ({ query }) =>
    searchAll(
      communityDb(),
      query,
      externalSearchEnabled(workerEnv),
    ));

  app.post("/api/posts", {
    body: PostInputSchema,
    response: {
      201: objectSchema<Record<string, unknown>>("created post"),
      429: objectSchema<{ error: string }>("rate limit"),
    },
  }, async ({ body, state }) => {
    if (String(body.website || "").trim()) {
      return created({ ok: true });
    }

    const clientAddress = typeof state.clientAddress === "string"
      ? state.clientAddress
      : "local";
    const fingerprint = await fingerprintFor(`workscout:v1:${clientAddress}`);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const recent = await communityDb().prepare(
      "SELECT COUNT(*) AS count FROM post_events WHERE fingerprint = ? AND created_at >= ?",
    ).bind(fingerprint, cutoff).first<{ count?: number }>();

    if (Number(recent?.count || 0) >= 4) {
      return reply(429, {
        error: "Too many posts from this connection. Try again later.",
      });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const company = body.company || "Independent";
    const skills = Array.isArray(body.skills)
      ? body.skills.join(",")
      : String(body.skills || "");

    await communityDb().batch([
      communityDb().prepare(
        `INSERT INTO posts
         (id, title, company, description, skills, work_type, location_scope, contact, budget, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      ).bind(
        id,
        body.title,
        company,
        body.description,
        skills,
        body.workType || "Contract",
        body.locationScope || "Worldwide",
        body.contact,
        body.budget || "",
        createdAt,
      ),
      communityDb().prepare(
        "INSERT INTO post_events (fingerprint, created_at) VALUES (?, ?)",
      ).bind(fingerprint, createdAt),
    ]);

    await communityDb().prepare(
      "DELETE FROM post_events WHERE created_at < ?",
    ).bind(
      new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    ).run().catch(() => undefined);

    return created({ ok: true, id, createdAt });
  });

  app.get("/api/posts", {
    response: objectSchema<{ items: unknown[] }>("post list"),
  }, async () => {
    const result = await communityDb().prepare(
      `SELECT id, title, company, description, skills, work_type, location_scope, budget, created_at
       FROM posts
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 50`,
    ).all();

    return { items: result.results || [] };
  });

  app.get("/api/watches", {
    response: objectSchema<{ items: unknown[] }>("watch list"),
  }, async ({ state }) => ({
    items: await listWatches(
      communityDb(),
      requireClientHash(state),
    ),
  }));

  app.post("/api/watches", {
    body: WatchInputSchema,
    response: {
      201: objectSchema<Record<string, unknown>>("created watch"),
    },
  }, async ({ body, state }) =>
    created(await createWatch(
      communityDb(),
      requireClientHash(state),
      body,
      externalSearchEnabled(workerEnv),
    )));

  app.post("/api/watches/:id/run", {
    response: objectSchema<Record<string, unknown>>("watch refresh"),
  }, async ({ params, state }) => {
    const clientHash = requireClientHash(state);
    const row = await getWatch(
      communityDb(),
      clientHash,
      params.id,
    );
    if (!row) throw new HttpError(404, "Watch not found.");

    return refreshWatch(communityDb(), row, {
      externalEnabled: externalSearchEnabled(workerEnv),
    });
  });

  app.get("/api/watches/:id/matches", {
    response: objectSchema<Record<string, unknown>>("watch matches"),
  }, async ({ params, state }) => {
    const result = await listWatchMatches(
      communityDb(),
      requireClientHash(state),
      params.id,
    );
    if (!result) throw new HttpError(404, "Watch not found.");
    return result;
  });

  app.post("/api/watches/:id/read", {
    response: objectSchema<{ ok: boolean }>("watch read"),
  }, async ({ params, state }) => {
    const ok = await markWatchViewed(
      communityDb(),
      requireClientHash(state),
      params.id,
    );
    if (!ok) throw new HttpError(404, "Watch not found.");
    return { ok: true };
  });

  app.delete("/api/watches/:id", {
    response: objectSchema<{ ok: boolean }>("deleted watch"),
  }, async ({ params, state }) => {
    const ok = await deleteWatch(
      communityDb(),
      requireClientHash(state),
      params.id,
    );
    if (!ok) throw new HttpError(404, "Watch not found.");
    return { ok: true };
  });

  app.get("/api/pipeline", {
    response: objectSchema<{ items: unknown[] }>("pipeline list"),
  }, async ({ state }) => ({
    items: await listPipeline(
      communityDb(),
      requireClientHash(state),
    ),
  }));

  app.post("/api/pipeline", {
    body: PipelineStatusSchema,
    response: objectSchema<Record<string, unknown>>("pipeline upsert"),
  }, async ({ body, state }) =>
    upsertPipeline(
      communityDb(),
      requireClientHash(state),
      body.item,
      body.status,
      body.notes,
    ));

  app.delete("/api/pipeline/:id", {
    response: objectSchema<{ ok: boolean }>("pipeline delete"),
  }, async ({ params, state }) => {
    await deletePipeline(
      communityDb(),
      requireClientHash(state),
      params.id,
    );
    return { ok: true };
  });

  return { app, db };
}

async function fingerprintFor(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

let runtime: ReturnType<typeof createRuntime> | null = null;
let readyPromise: Promise<void> | null = null;
let listener: OpenMeshListener | null = null;

const server = createServer((req, res) => {
  if (!listener) {
    res.statusCode = 503;
    res.end("WorkScout API is starting");
    return;
  }
  listener(req, res);
});
server.listen(OPENMESH_PORT);

async function ensureReady(workerEnv: RuntimeEnv) {
  if (!runtime) {
    runtime = createRuntime(workerEnv);
  }

  if (!readyPromise) {
    readyPromise = runtime.app.ready().then(() => {
      listener = runtime!.app.callback();
    }).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }

  return readyPromise;
}

export default {
  async fetch(
    request: Request,
    workerEnv: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const runtimeEnv = workerEnv as RuntimeEnv;

    if (url.pathname.startsWith("/api/")) {
      await ensureReady(runtimeEnv);
      return handleAsNodeRequest(
        OPENMESH_PORT,
        request,
        runtimeEnv,
        ctx,
      );
    }

    return runtimeEnv.ASSETS.fetch(request);
  },

  async scheduled(
    _controller: ScheduledController,
    workerEnv: Env,
    ctx: ExecutionContext,
  ) {
    const runtimeEnv = workerEnv as RuntimeEnv;
    ctx.waitUntil(
      refreshDueWatches(runtimeEnv.DB, {
        limit: 8,
        externalEnabled: externalSearchEnabled(runtimeEnv),
      }).then((summary) => {
        console.log("WorkScout Scout Watch refresh", summary);
      }),
    );
  },
};
