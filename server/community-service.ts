import { randomUUID } from "node:crypto";
import openmesh, { created, reply } from "openmesh-node";
import { bodyParser } from "openmesh-node/plugins";
import {
  serviceRegistration,
  type ControlClient,
} from "openmesh-node/services";
import {
  communityRowToItem,
  planQuery,
} from "../worker/search";
import {
  CommunityPostRequestSchema,
  SearchPreferencesSchema,
  jsonObjectSchema,
  type ApiError,
  type CommunitySearchResponse,
  type PostCreated,
} from "./contracts";
import { createCommunityDatabase } from "./database";
import { addressUrl } from "./runtime";

export type CommunityServiceOptions = {
  client: ControlClient;
  host: string;
  port: number;
  databasePath?: string;
};

export function createCommunityService({
  client,
  host,
  port,
  databasePath,
}: CommunityServiceOptions) {
  const id = `community-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const db = createCommunityDatabase(databasePath);

  const app = openmesh({ service: "community" })
    .use(bodyParser())
    .register(db.resource)
    .register(serviceRegistration({
      client,
      service: "community",
      id,
      ttl: 15_000,
      metadata: {
        version: "v1",
        storage: "sqlite",
      },
      url: (address) => addressUrl(address),
    }))
    .post("/search", {
      body: SearchPreferencesSchema,
      response: jsonObjectSchema<CommunitySearchResponse>("community search response"),
    }, async ({ body }) => {
      const plan = planQuery(body.raw);
      const items = db.client.searchRows(body)
        .map((row) => communityRowToItem(row, body, plan.terms));

      return {
        items,
        source: {
          name: "WorkScout Community",
          ok: true,
          count: items.length,
          error: null,
        },
      };
    })
    .post("/posts", {
      body: CommunityPostRequestSchema,
      response: {
        201: jsonObjectSchema<PostCreated>("post created"),
        429: jsonObjectSchema<ApiError>("rate limit error"),
      },
    }, async ({ body }) => {
      const now = Date.now();
      const cutoff = new Date(now - 60 * 60 * 1000).toISOString();
      const createdAt = new Date(now).toISOString();

      const result = await db.resource.transaction(async (store) => {
        if (store.recentPostCount(body.fingerprint, cutoff) >= 4) {
          return null;
        }

        const id = randomUUID();
        store.insertPost(body.post, body.fingerprint, id, createdAt);
        return { ok: true as const, id, createdAt };
      });

      if (!result) {
        return reply(429, {
          error: "Too many posts from this connection. Try again later.",
        });
      }

      setImmediate(() => {
        try {
          db.client.cleanupEvents(
            new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          );
        } catch {}
      });

      return created(result);
    })
    .get("/posts", {
      response: jsonObjectSchema<{ items: ReturnType<typeof db.client.listPosts> }>("post list"),
    }, async () => ({
      items: db.client.listPosts(),
    }))
    .get("/health", async () => ({
      ok: await db.resource.healthy(),
      service: "community",
      database: db.resource.state,
    }));

  return {
    app,
    db: db.resource,
    id,
    async listen() {
      return app.listen({ host, port });
    },
  };
}
