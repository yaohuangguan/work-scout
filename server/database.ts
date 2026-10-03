import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { database } from "openmesh-node/db";
import { planQuery, type SearchPreferences } from "../worker/search";
import type { PostInput } from "./contracts";

export type CommunityRow = {
  id: string;
  title: string;
  company: string;
  description: string;
  skills: string;
  work_type: string;
  location_scope: string;
  contact: string;
  budget: string;
  created_at: string;
  status: string;
};

export type PublicPostRow = Omit<CommunityRow, "contact" | "status">;

export interface CommunityStore {
  readonly kind: "sqlite" | "postgres";
  open(): void | Promise<void>;
  close(): void | Promise<void>;
  ping(): boolean | Promise<boolean>;
  searchRows(prefs: SearchPreferences): CommunityRow[] | Promise<CommunityRow[]>;
  listPosts(): PublicPostRow[] | Promise<PublicPostRow[]>;
  recentPostCount(fingerprint: string, cutoff: string): number | Promise<number>;
  insertPost(post: PostInput, fingerprint: string, id: string, createdAt: string): void | Promise<void>;
  cleanupEvents(cutoff: string): void | Promise<void>;
  transaction<T>(work: (db: CommunityStore) => T | Promise<T>): Promise<T>;
}

export class SqliteCommunityDatabase implements CommunityStore {
  readonly kind = "sqlite" as const;
  readonly path: string;
  private sqlite: DatabaseSync | null = null;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  open(): void {
    if (this.sqlite) return;
    mkdirSync(dirname(this.path), { recursive: true });
    this.sqlite = new DatabaseSync(this.path);
    this.sqlite.exec("PRAGMA journal_mode = WAL;");
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
    const schema = readFileSync(resolve(process.cwd(), "schema.sql"), "utf8");
    this.sqlite.exec(schema);
  }

  close(): void {
    if (!this.sqlite) return;
    this.sqlite.close();
    this.sqlite = null;
  }

  ping(): boolean {
    if (!this.sqlite) return false;
    const row = this.sqlite.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;
    return row?.ok === 1;
  }

  private db(): DatabaseSync {
    if (!this.sqlite) throw new Error("Community database is not open");
    return this.sqlite;
  }

  searchRows(prefs: SearchPreferences): CommunityRow[] {
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

    return this.db().prepare(sql).all(...args) as CommunityRow[];
  }

  listPosts(): PublicPostRow[] {
    return this.db().prepare(
      `SELECT id, title, company, description, skills, work_type, location_scope, budget, created_at
       FROM posts
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 50`,
    ).all() as PublicPostRow[];
  }

  recentPostCount(fingerprint: string, cutoff: string): number {
    const row = this.db().prepare(
      "SELECT COUNT(*) AS count FROM post_events WHERE fingerprint = ? AND created_at >= ?",
    ).get(fingerprint, cutoff) as { count?: number } | undefined;
    return Number(row?.count || 0);
  }

  insertPost(post: PostInput, fingerprint: string, id: string, createdAt: string): void {
    const values = normalizePost(post);

    this.db().prepare(
      `INSERT INTO posts
       (id, title, company, description, skills, work_type, location_scope, contact, budget, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    ).run(
      id,
      post.title,
      values.company,
      post.description,
      values.skills,
      values.workType,
      values.locationScope,
      post.contact,
      values.budget,
      createdAt,
    );

    this.db().prepare(
      "INSERT INTO post_events (fingerprint, created_at) VALUES (?, ?)",
    ).run(fingerprint, createdAt);
  }

  cleanupEvents(cutoff: string): void {
    this.db().prepare("DELETE FROM post_events WHERE created_at < ?").run(cutoff);
  }

  async transaction<T>(work: (db: CommunityStore) => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const db = this.db();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await work(this);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      release();
    }
  }
}

type PgExecutor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export class PostgresCommunityDatabase implements CommunityStore {
  readonly kind = "postgres" as const;
  private readonly pool: Pool;
  private readonly executor: PgExecutor;
  private readonly ownsPool: boolean;

  constructor(connectionString: string, pool?: Pool, executor?: PgExecutor) {
    this.pool = pool || new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.executor = executor || this.pool;
    this.ownsPool = !pool;
  }

  async open(): Promise<void> {
    if (!this.ownsPool) return;
    const schema = readFileSync(resolve(process.cwd(), "schema.sql"), "utf8");
    await this.pool.query(schema);
  }

  async close(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }

  async ping(): Promise<boolean> {
    const result = await this.executor.query("SELECT 1 AS ok");
    return Number(result.rows[0]?.ok) === 1;
  }

  async searchRows(prefs: SearchPreferences): Promise<CommunityRow[]> {
    const plan = planQuery(prefs.raw);
    const terms = plan.terms.slice(0, 6);
    const values: string[] = [];
    const like = terms.map((term) => {
      const value = `%${term.toLowerCase()}%`;
      const indexes = [value, value, value].map((entry) => {
        values.push(entry);
        return "$" + values.length;
      });
      return `(lower(title) LIKE ${indexes[0]} OR lower(description) LIKE ${indexes[1]} OR lower(skills) LIKE ${indexes[2]})`;
    }).join(" OR ");

    const sql = terms.length
      ? `SELECT * FROM posts WHERE status = 'active' AND (${like}) ORDER BY created_at DESC LIMIT 40`
      : "SELECT * FROM posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 40";

    return rows<CommunityRow>(await this.executor.query(sql, values));
  }

  async listPosts(): Promise<PublicPostRow[]> {
    return rows<PublicPostRow>(await this.executor.query(
      `SELECT id, title, company, description, skills, work_type, location_scope, budget, created_at
       FROM posts
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 50`,
    ));
  }

  async recentPostCount(fingerprint: string, cutoff: string): Promise<number> {
    const result = await this.executor.query(
      "SELECT COUNT(*)::int AS count FROM post_events WHERE fingerprint = $1 AND created_at >= $2",
      [fingerprint, cutoff],
    );
    return Number(result.rows[0]?.count || 0);
  }

  async insertPost(post: PostInput, fingerprint: string, id: string, createdAt: string): Promise<void> {
    const values = normalizePost(post);

    await this.executor.query(
      `INSERT INTO posts
       (id, title, company, description, skills, work_type, location_scope, contact, budget, created_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
      [
        id,
        post.title,
        values.company,
        post.description,
        values.skills,
        values.workType,
        values.locationScope,
        post.contact,
        values.budget,
        createdAt,
      ],
    );

    await this.executor.query(
      "INSERT INTO post_events (fingerprint, created_at) VALUES ($1, $2)",
      [fingerprint, createdAt],
    );
  }

  async cleanupEvents(cutoff: string): Promise<void> {
    await this.executor.query(
      "DELETE FROM post_events WHERE created_at < $1",
      [cutoff],
    );
  }

  async transaction<T>(work: (db: CommunityStore) => T | Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const scoped = new PostgresCommunityDatabase("", this.pool, client);
      const result = await work(scoped);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}

function rows<T extends QueryResultRow>(result: { rows: QueryResultRow[] }): T[] {
  return result.rows as T[];
}

function normalizePost(post: PostInput) {
  return {
    company: String(post.company || "").trim() || "Independent",
    skills: Array.isArray(post.skills) ? post.skills.join(",") : String(post.skills || ""),
    workType: String(post.workType || "Contract").trim(),
    locationScope: String(post.locationScope || "Worldwide").trim(),
    budget: String(post.budget || "").trim(),
  };
}

export function createCommunityDatabase(
  path = process.env.WORKSCOUT_DB_PATH,
  databaseUrl = process.env.DATABASE_URL,
) {
  const client: CommunityStore = databaseUrl
    ? new PostgresCommunityDatabase(databaseUrl)
    : new SqliteCommunityDatabase(resolve(path || ".data/workscout.sqlite"));

  const resource = database<CommunityStore>(client, {
    name: "community",
    connect: (current) => current.open(),
    disconnect: (current) => current.close(),
    ping: (current) => current.ping(),
    transaction: (current, work) => current.transaction(work),
  });

  return { client, resource };
}
