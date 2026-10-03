import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

export type CreatePostResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; reason: "rate-limit" };

export class CommunityDatabase {
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
    const company = String(post.company || "").trim() || "Independent";
    const skills = Array.isArray(post.skills) ? post.skills.join(",") : String(post.skills || "");
    const workType = String(post.workType || "Contract").trim();
    const locationScope = String(post.locationScope || "Worldwide").trim();
    const budget = String(post.budget || "").trim();

    this.db().prepare(
      `INSERT INTO posts
       (id, title, company, description, skills, work_type, location_scope, contact, budget, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    ).run(
      id,
      post.title,
      company,
      post.description,
      skills,
      workType,
      locationScope,
      post.contact,
      budget,
      createdAt,
    );

    this.db().prepare(
      "INSERT INTO post_events (fingerprint, created_at) VALUES (?, ?)",
    ).run(fingerprint, createdAt);
  }

  cleanupEvents(cutoff: string): void {
    this.db().prepare("DELETE FROM post_events WHERE created_at < ?").run(cutoff);
  }

  async transaction<T>(work: (db: CommunityDatabase) => T | Promise<T>): Promise<T> {
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

export function createCommunityDatabase(path = process.env.WORKSCOUT_DB_PATH) {
  const dbPath = resolve(path || ".data/workscout.sqlite");
  const client = new CommunityDatabase(dbPath);
  const resource = database<CommunityDatabase>(client, {
    name: "community",
    connect: (current) => current.open(),
    disconnect: (current) => current.close(),
    ping: (current) => current.ping(),
    transaction: (current, work) => current.transaction(work),
  });
  return { client, resource };
}
