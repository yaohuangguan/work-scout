import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import { env } from "cloudflare:workers";
import openmesh, { HttpError, created, reply } from "openmesh-node";
import { database } from "openmesh-node/db";
import { bodyParser } from "openmesh-node/plugins";
import {
  communityRowToItem,
  dedupeWorkItems,
  planQuery,
  searchExternal,
  type SearchPreferences,
} from "./search";
import {
  PostInputSchema,
  SearchQuerySchema,
  objectSchema,
  type PostInput,
} from "./contracts";

const OPENMESH_PORT = 8787;

const db = database(env.DB, {
  name: "workscout-d1",
});

const app = openmesh()
  .use(bodyParser())
  .register(db);

app.use(async (ctx, next) => {
  ctx.set("access-control-allow-origin", "*");
  ctx.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  ctx.set("access-control-allow-headers", "content-type");

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

async function getCommunity(prefs: SearchPreferences) {
  const plan = planQuery(prefs.raw);
  const terms = plan.terms.slice(0, 6);
  const like = terms
    .map(() => "(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(skills) LIKE ?)")
    .join(" OR ");
  const sql = terms.length
    ? `SELECT * FROM posts WHERE status = 'active' AND (${like}) ORDER BY created_at DESC LIMIT 40`
    : "SELECT * FROM posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 40";
  const args = terms.flatMap((term) => {
    const value = `%${term.toLowerCase()}%`;
    return [value, value, value];
  });

  const result = await communityDb().prepare(sql).bind(...args).all();
  return (result.results || []).map((row) =>
    communityRowToItem(row, prefs, plan.terms)
  );
}

async function fingerprintFor(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
    "Reddit r/forhire",
    "HN Freelance",
    "Himalayas",
    "Remote OK",
    "Remotive",
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
}, async ({ query }) => {
  const [external, community] = await Promise.all([
    searchExternal(query),
    getCommunity(query).catch(() => []),
  ]);

  const items = dedupeWorkItems([
    ...community,
    ...external.items,
  ])
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  return {
    query,
    plan: external.plan,
    count: items.length,
    items,
    sources: [
      ...external.sources,
      {
        name: "WorkScout Community",
        ok: true,
        count: community.length,
        error: null,
      },
    ],
  };
});

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

let readyPromise: Promise<void> | null = null;
let listener: ReturnType<typeof app.callback> | null = null;

const server = createServer((req, res) => {
  if (!listener) {
    res.statusCode = 503;
    res.end("WorkScout API is starting");
    return;
  }
  listener(req, res);
});
server.listen(OPENMESH_PORT);

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = app.ready().then(() => {
      listener = app.callback();
    });
  }
  return readyPromise;
}

export default {
  async fetch(
    request: Request,
    _workerEnv: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      await ensureReady();
      return handleAsNodeRequest(OPENMESH_PORT, request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
