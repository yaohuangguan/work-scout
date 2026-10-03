import {
  communityRowToItem,
  dedupeWorkItems,
  planQuery,
  searchExternal,
  type SearchPreferences,
  type WorkItem,
} from "./search";
import type { WatchInput } from "./contracts";

export const EXTERNAL_SOURCES = [
  "Reddit r/forhire",
  "HN Freelance",
  "Himalayas",
  "Remote OK",
  "Remotive",
] as const;

type Db = any;

export type WatchRow = {
  id: string;
  client_hash: string;
  label: string;
  query: string;
  country_code: string;
  country_label: string;
  hours_per_week: number;
  work_types: string;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
  last_match_at: string | null;
  enabled: number;
  last_error: string;
};

export type WatchSummary = {
  id: string;
  label: string;
  query: string;
  country: string;
  countryLabel: string;
  hours: number;
  types: string[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  lastMatchAt: string | null;
  enabled: boolean;
  lastError: string;
  matchCount: number;
  newCount: number;
};

export type PipelineStatus =
  | "saved"
  | "contacted"
  | "applied"
  | "interview"
  | "offer"
  | "closed";

async function getCommunity(db: Db, prefs: SearchPreferences) {
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

  const result = await db.prepare(sql).bind(...args).all();
  return (result.results || []).map((row: any) =>
    communityRowToItem(row, prefs, plan.terms)
  );
}

export async function searchAll(
  db: Db,
  prefs: SearchPreferences,
  externalEnabled = true,
) {
  const [external, community] = await Promise.all([
    externalEnabled
      ? searchExternal(prefs)
      : Promise.resolve({
          plan: planQuery(prefs.raw),
          items: [] as WorkItem[],
          sources: EXTERNAL_SOURCES.map((name) => ({
            name,
            ok: false,
            count: 0,
            error: "External search disabled",
          })),
        }),
    getCommunity(db, prefs).catch(() => [] as WorkItem[]),
  ]);

  const items = dedupeWorkItems([
    ...community,
    ...external.items,
  ])
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  return {
    query: prefs,
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
}

export function watchPrefs(row: WatchRow): SearchPreferences {
  return {
    raw: row.query,
    countryCode: row.country_code,
    countryLabel: row.country_label,
    hoursPerWeek: Number(row.hours_per_week) || 20,
    workTypes: String(row.work_types || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function watchCandidates(items: WorkItem[]) {
  return items
    .filter((item) =>
      item.eligibility !== "restricted"
      && item.score >= 40
      && item.why.some((reason) => reason.startsWith("Matches "))
    )
    .slice(0, 40);
}

function mapWatch(row: any): WatchSummary {
  return {
    id: String(row.id),
    label: String(row.label || ""),
    query: String(row.query),
    country: String(row.country_code || "ANY"),
    countryLabel: String(row.country_label || "Anywhere / not sure"),
    hours: Number(row.hours_per_week || 20),
    types: String(row.work_types || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    lastMatchAt: row.last_match_at ? String(row.last_match_at) : null,
    enabled: Number(row.enabled) === 1,
    lastError: String(row.last_error || ""),
    matchCount: Number(row.match_count || 0),
    newCount: Number(row.new_count || 0),
  };
}

export async function listWatches(db: Db, clientHash: string): Promise<WatchSummary[]> {
  const result = await db.prepare(
    `SELECT
       w.*,
       COUNT(m.item_id) AS match_count,
       SUM(CASE WHEN m.item_id IS NOT NULL AND m.viewed_at IS NULL THEN 1 ELSE 0 END) AS new_count
     FROM search_watches w
     LEFT JOIN watch_matches m ON m.watch_id = w.id
     WHERE w.client_hash = ?
     GROUP BY w.id
     ORDER BY w.updated_at DESC`,
  ).bind(clientHash).all();

  return (result.results || []).map(mapWatch);
}

export async function getWatch(
  db: Db,
  clientHash: string,
  id: string,
): Promise<WatchRow | null> {
  return db.prepare(
    "SELECT * FROM search_watches WHERE id = ? AND client_hash = ?",
  ).bind(id, clientHash).first() as Promise<WatchRow | null>;
}

export async function createWatch(
  db: Db,
  clientHash: string,
  input: WatchInput,
  externalEnabled = true,
) {
  const workTypes = input.types.join(",");
  const existing = await db.prepare(
    `SELECT id
     FROM search_watches
     WHERE client_hash = ?
       AND lower(query) = lower(?)
       AND country_code = ?
       AND hours_per_week = ?
       AND work_types = ?
       AND enabled = 1
     LIMIT 1`,
  ).bind(
    clientHash,
    input.query,
    input.country,
    input.hours,
    workTypes,
  ).first();

  if (existing?.id) {
    return {
      id: String(existing.id),
      baselineCount: 0,
      newCount: 0,
      existing: true,
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO search_watches
     (id, client_hash, label, query, country_code, country_label, hours_per_week, work_types,
      created_at, updated_at, last_checked_at, last_match_at, enabled, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, '')`,
  ).bind(
    id,
    clientHash,
    input.label || input.query.slice(0, 80),
    input.query,
    input.country,
    input.countryLabel,
    input.hours,
    input.types.join(","),
    now,
    now,
  ).run();

  const row = await getWatch(db, clientHash, id);
  if (!row) throw new Error("Created watch could not be loaded");

  const refresh = await refreshWatch(db, row, {
    baseline: true,
    externalEnabled,
  });

  return {
    id,
    baselineCount: refresh.totalCount,
    newCount: 0,
  };
}

export async function refreshWatch(
  db: Db,
  row: WatchRow,
  options: { baseline?: boolean; externalEnabled?: boolean } = {},
) {
  const now = new Date().toISOString();

  try {
    const result = await searchAll(
      db,
      watchPrefs(row),
      options.externalEnabled !== false,
    );
    const candidates = watchCandidates(result.items);

    let inserted = 0;
    if (candidates.length) {
      const statements = candidates.map((item) =>
        db.prepare(
          `INSERT OR IGNORE INTO watch_matches
           (watch_id, item_id, item_json, first_seen_at, viewed_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          row.id,
          item.id,
          JSON.stringify(item),
          now,
          options.baseline ? now : null,
        )
      );
      const results = await db.batch(statements);
      inserted = results.reduce(
        (sum: number, entry: any) => sum + Number(entry?.meta?.changes || 0),
        0,
      );
    }

    await db.prepare(
      `UPDATE search_watches
       SET updated_at = ?,
           last_checked_at = ?,
           last_match_at = CASE WHEN ? > 0 THEN ? ELSE last_match_at END,
           last_error = ''
       WHERE id = ?`,
    ).bind(now, now, inserted, now, row.id).run();

    return {
      newCount: options.baseline ? 0 : inserted,
      totalCount: candidates.length,
      checkedAt: now,
      sources: result.sources,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.prepare(
      `UPDATE search_watches
       SET updated_at = ?, last_checked_at = ?, last_error = ?
       WHERE id = ?`,
    ).bind(now, now, message.slice(0, 300), row.id).run();
    throw error;
  }
}

export async function listWatchMatches(
  db: Db,
  clientHash: string,
  watchId: string,
) {
  const watch = await getWatch(db, clientHash, watchId);
  if (!watch) return null;

  const result = await db.prepare(
    `SELECT item_json, first_seen_at, viewed_at
     FROM watch_matches
     WHERE watch_id = ?
     ORDER BY first_seen_at DESC
     LIMIT 100`,
  ).bind(watchId).all();

  return {
    watch: mapWatch({
      ...watch,
      match_count: result.results?.length || 0,
      new_count: (result.results || []).filter((row: any) => !row.viewed_at).length,
    }),
    items: (result.results || []).flatMap((row: any) => {
      try {
        return [{
          item: JSON.parse(String(row.item_json)) as WorkItem,
          firstSeenAt: String(row.first_seen_at),
          isNew: !row.viewed_at,
        }];
      } catch {
        return [];
      }
    }),
  };
}

export async function markWatchViewed(
  db: Db,
  clientHash: string,
  watchId: string,
) {
  const watch = await getWatch(db, clientHash, watchId);
  if (!watch) return false;

  await db.prepare(
    "UPDATE watch_matches SET viewed_at = ? WHERE watch_id = ? AND viewed_at IS NULL",
  ).bind(new Date().toISOString(), watchId).run();
  return true;
}

export async function deleteWatch(
  db: Db,
  clientHash: string,
  watchId: string,
) {
  const watch = await getWatch(db, clientHash, watchId);
  if (!watch) return false;

  await db.batch([
    db.prepare("DELETE FROM watch_matches WHERE watch_id = ?").bind(watchId),
    db.prepare("DELETE FROM search_watches WHERE id = ? AND client_hash = ?")
      .bind(watchId, clientHash),
  ]);
  return true;
}

export async function refreshDueWatches(
  db: Db,
  options: { limit?: number; externalEnabled?: boolean } = {},
) {
  const limit = Math.max(1, Math.min(20, options.limit || 8));
  const dueBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(
    `SELECT * FROM search_watches
     WHERE enabled = 1
       AND (last_checked_at IS NULL OR last_checked_at <= ?)
     ORDER BY COALESCE(last_checked_at, '') ASC
     LIMIT ?`,
  ).bind(dueBefore, limit).all() as { results?: WatchRow[] };

  let checked = 0;
  let newMatches = 0;
  let failed = 0;

  for (const row of result.results || []) {
    try {
      const refresh = await refreshWatch(db, row, {
        externalEnabled: options.externalEnabled,
      });
      checked += 1;
      newMatches += refresh.newCount;
    } catch {
      failed += 1;
    }
  }

  return { checked, newMatches, failed };
}

export async function listPipeline(db: Db, clientHash: string) {
  const result = await db.prepare(
    `SELECT item_json, status, notes, created_at, updated_at
     FROM application_pipeline
     WHERE client_hash = ?
     ORDER BY updated_at DESC
     LIMIT 200`,
  ).bind(clientHash).all();

  return (result.results || []).flatMap((row: any) => {
    try {
      return [{
        item: JSON.parse(String(row.item_json)) as WorkItem,
        status: String(row.status) as PipelineStatus,
        notes: String(row.notes || ""),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }];
    } catch {
      return [];
    }
  });
}

export async function upsertPipeline(
  db: Db,
  clientHash: string,
  item: Record<string, unknown>,
  status: PipelineStatus,
  notes: string,
) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO application_pipeline
     (client_hash, item_id, item_json, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_hash, item_id) DO UPDATE SET
       item_json = excluded.item_json,
       status = excluded.status,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).bind(
    clientHash,
    String(item.id),
    JSON.stringify(item),
    status,
    notes,
    now,
    now,
  ).run();

  return { ok: true, updatedAt: now };
}

export async function deletePipeline(
  db: Db,
  clientHash: string,
  itemId: string,
) {
  await db.prepare(
    "DELETE FROM application_pipeline WHERE client_hash = ? AND item_id = ?",
  ).bind(clientHash, itemId).run();
  return true;
}
