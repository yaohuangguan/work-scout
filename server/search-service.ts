import openmesh from "openmesh-node";
import { bodyParser } from "openmesh-node/plugins";
import {
  serviceRegistration,
  type ControlClient,
} from "openmesh-node/services";
import {
  planQuery,
  searchExternal,
  type SearchPreferences,
} from "../worker/search";
import {
  SearchPreferencesSchema,
  jsonObjectSchema,
  type ExternalSearchResponse,
} from "./contracts";
import {
  addressUrl,
  EXTERNAL_SOURCE_NAMES,
} from "./runtime";

export type SearchServiceOptions = {
  client: ControlClient;
  host: string;
  port: number;
  externalSearch?: boolean;
  cacheTtlMs?: number;
};

export function createSearchService({
  client,
  host,
  port,
  externalSearch = true,
  cacheTtlMs = 90_000,
}: SearchServiceOptions) {
  const id = `search-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const cache = new Map<string, { expiresAt: number; value: ExternalSearchResponse }>();

  const app = openmesh({ service: "search" })
    .use(bodyParser())
    .register(serviceRegistration({
      client,
      service: "search",
      id,
      ttl: 15_000,
      metadata: {
        version: "v1",
        kind: "external-search",
      },
      url: (address) => addressUrl(address),
    }))
    .post("/search", {
      body: SearchPreferencesSchema,
      response: jsonObjectSchema<ExternalSearchResponse>("external search response"),
    }, async ({ body }) => {
      if (!externalSearch) {
        return {
          plan: planQuery(body.raw),
          items: [],
          sources: EXTERNAL_SOURCE_NAMES.map((name) => ({
            name,
            ok: false,
            count: 0,
            error: "External search disabled",
          })),
        };
      }

      const cacheKey = JSON.stringify([
        body.raw.toLowerCase(),
        body.countryCode,
        body.hoursPerWeek,
        [...body.workTypes].sort(),
      ]);
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.value;

      const value = await searchExternal(body);
      cache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value,
      });

      if (cache.size > 200) {
        for (const [key, entry] of cache) {
          if (entry.expiresAt <= Date.now() || cache.size > 180) cache.delete(key);
        }
      }

      return value;
    })
    .get("/health", () => ({
      ok: true,
      service: "search",
      externalSearch,
    }));

  return {
    app,
    id,
    async listen() {
      return app.listen({ host, port });
    },
  };
}
