import { Hono } from "hono";
import { cors } from "hono/cors";
import { communityRowToItem, dedupeWorkItems, planQuery, searchExternal, type SearchPreferences } from "./search";

type Env = {
  Bindings: {
    DB?: any;
    ASSETS?: any;
  };
};

const app = new Hono<Env>();
app.use("/api/*", cors());

function parsePrefs(url: URL): SearchPreferences {
  const raw = (url.searchParams.get("q") || "").trim() || "remote";
  const countryCode = (url.searchParams.get("country") || "ANY").toUpperCase();
  const countryLabel = url.searchParams.get("countryLabel") || (countryCode === "ANY" ? "Anywhere / not sure" : countryCode);
  const hours = Number(url.searchParams.get("hours") || "20");
  const types = (url.searchParams.get("types") || "contract,part-time,gig")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    raw,
    countryCode,
    countryLabel,
    hoursPerWeek: Number.isFinite(hours) ? Math.max(1, Math.min(80, hours)) : 20,
    workTypes: types,
  };
}

async function getCommunity(db: any, prefs: SearchPreferences) {
  if (!db) return [];
  const plan = planQuery(prefs.raw);
  const terms = plan.terms.slice(0, 6);
  const like = terms.map(() => "(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(skills) LIKE ?)").join(" OR ");
  const sql = terms.length
    ? `SELECT * FROM posts WHERE status = 'active' AND (${like}) ORDER BY created_at DESC LIMIT 40`
    : "SELECT * FROM posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 40";
  const args = terms.flatMap((term) => {
    const value = `%${term.toLowerCase()}%`;
    return [value, value, value];
  });
  const result = await db.prepare(sql).bind(...args).all();
  return (result.results || []).map((row: any) => communityRowToItem(row, prefs, plan.terms));
}

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "workscout",
    now: new Date().toISOString(),
    sources: ["Reddit r/forhire", "HN Freelance", "Himalayas", "Remote OK", "Remotive", "WorkScout Community"],
  })
);

app.get("/api/meta", (c) => {
  const request = c.req.raw as Request & { cf?: { country?: string } };
  const detected = String(request.cf?.country || "").toUpperCase();
  const supported = new Set(["NZ", "AU", "US", "CA", "GB"]);
  return c.json({ country: supported.has(detected) ? detected : "ANY" });
});

app.get("/api/search", async (c) => {
  const prefs = parsePrefs(new URL(c.req.url));
  const [external, community] = await Promise.all([
    searchExternal(prefs),
    getCommunity(c.env.DB, prefs).catch(() => []),
  ]);

  const items = dedupeWorkItems([...community, ...external.items])
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  return c.json({
    query: prefs,
    plan: external.plan,
    count: items.length,
    items,
    sources: [
      ...external.sources,
      { name: "WorkScout Community", ok: Boolean(c.env.DB), count: community.length, error: c.env.DB ? null : "D1 not bound" },
    ],
  });
});

async function fingerprintFor(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

app.post("/api/posts", async (c) => {
  if (!c.env.DB) return c.json({ error: "Posting database is not configured." }, 503);

  const body = await c.req.json().catch(() => null) as any;
  if (!body) return c.json({ error: "Invalid JSON body." }, 400);
  if (String(body.website || "").trim()) return c.json({ ok: true }, 201);

  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "local";
  const fingerprint = await fingerprintFor(`workscout:v1:${ip}`);
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM post_events WHERE fingerprint = ? AND created_at >= ?"
  ).bind(fingerprint, cutoff).first();

  if (Number(recent?.count || 0) >= 4) {
    return c.json({ error: "Too many posts from this connection. Try again later." }, 429);
  }

  const title = String(body.title || "").trim();
  const company = String(body.company || "").trim() || "Independent";
  const description = String(body.description || "").trim();
  const contact = String(body.contact || "").trim();
  const skills = Array.isArray(body.skills) ? body.skills.join(",") : String(body.skills || "");
  const workType = String(body.workType || "Contract").trim();
  const locationScope = String(body.locationScope || "Worldwide").trim();
  const budget = String(body.budget || "").trim();

  if (title.length < 3 || title.length > 120) return c.json({ error: "Title must be 3–120 characters." }, 400);
  if (description.length < 20 || description.length > 3000) return c.json({ error: "Description must be 20–3000 characters." }, 400);
  if (contact.length < 5 || contact.length > 300) return c.json({ error: "Add an email or application URL." }, 400);
  if (!contact.includes("@") && !/^https?:\/\//i.test(contact)) return c.json({ error: "Contact must be an email or http(s) URL." }, 400);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO posts (id, title, company, description, skills, work_type, location_scope, contact, budget, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(id, title, company, description, skills, workType, locationScope, contact, budget, createdAt),
    c.env.DB.prepare(
      "INSERT INTO post_events (fingerprint, created_at) VALUES (?, ?)"
    ).bind(fingerprint, createdAt),
  ]);

  c.executionCtx.waitUntil(
    c.env.DB.prepare("DELETE FROM post_events WHERE created_at < ?")
      .bind(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .run()
      .catch(() => undefined)
  );

  return c.json({ ok: true, id, createdAt }, 201);
});

app.get("/api/posts", async (c) => {
  if (!c.env.DB) return c.json({ items: [] });
  const result = await c.env.DB.prepare(
    "SELECT id, title, company, description, skills, work_type, location_scope, budget, created_at FROM posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json({ items: result.results || [] });
});

app.all("*", async (c) => {
  if (!c.env.ASSETS) return c.text("WorkScout API", 200);
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
