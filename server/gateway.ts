import { createHash } from "node:crypto";
import openmesh, { HttpError, MeshHttpError, created, reply } from "openmesh-node";
import { bodyParser, currentRequestContext } from "openmesh-node/plugins";
import {
  dedupeWorkItems,
  planQuery,
  type WorkItem,
} from "../worker/search";
import {
  PostInputSchema,
  SearchQuerySchema,
  jsonObjectSchema,
  type ApiError,
  type CommunitySearchResponse,
  type ExternalSearchResponse,
  type PostCreated,
  type SearchResponse,
} from "./contracts";
import { EXTERNAL_SOURCE_NAMES } from "./runtime";

type GatewayOptions = {
  controlUrl: string;
  controlToken: string;
  host: string;
  port: number;
};

function headerValue(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  name: string,
): string {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted || value === undefined) continue;
    return Array.isArray(value) ? value[0] || "" : value;
  }
  return "";
}

function fingerprint(
  headers: Readonly<Record<string, string | string[] | undefined>>,
) {
  const ip = headerValue(headers, "cf-connecting-ip")
    || headerValue(headers, "x-forwarded-for").split(",")[0]?.trim()
    || "local";
  return createHash("sha256")
    .update(`workscout:v1:${ip}`)
    .digest("hex");
}

function unavailableSources() {
  return EXTERNAL_SOURCE_NAMES.map((name) => ({
    name,
    ok: false,
    count: 0,
    error: "Search service unavailable",
  }));
}

export function createGateway({
  controlUrl,
  controlToken,
  host,
  port,
}: GatewayOptions) {
  const app = openmesh({
    service: "gateway",
    mesh: {
      control: {
        url: controlUrl,
        token: controlToken,
        timeout: 5_000,
      },
      defaults: {
        timeout: 12_000,
        retries: 1,
        maxInflight: 64,
        maxQueue: 128,
        adaptiveConcurrency: true,
      },
      services: {
        search: {
          maxInflight: 24,
          maxQueue: 48,
        },
        community: {
          maxInflight: 32,
          maxQueue: 64,
        },
      },
    },
  }).use(bodyParser());

  app.use(async (ctx, next) => {
    ctx.set("access-control-allow-origin", "*");
    ctx.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    ctx.set("access-control-allow-headers", "content-type");
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

    ctx.status = 500;
    return { error: "Internal server error." };
  });

  const search = app.mesh("search");
  const community = app.mesh("community");

  app.get("/api/health", {
    response: jsonObjectSchema<Record<string, unknown>>("gateway health"),
  }, async () => {
    const [searchPeers, communityPeers] = await Promise.allSettled([
      search.stats(),
      community.stats(),
    ]);

    return {
      ok: searchPeers.status === "fulfilled" || communityPeers.status === "fulfilled",
      service: "workscout-gateway",
      runtime: "openmesh",
      now: new Date().toISOString(),
      services: {
        search: searchPeers.status === "fulfilled"
          ? { ok: searchPeers.value.length > 0, peers: searchPeers.value.length }
          : { ok: false, error: String(searchPeers.reason) },
        community: communityPeers.status === "fulfilled"
          ? { ok: communityPeers.value.length > 0, peers: communityPeers.value.length }
          : { ok: false, error: String(communityPeers.reason) },
      },
      sources: [
        ...EXTERNAL_SOURCE_NAMES,
        "WorkScout Community",
      ],
    };
  });

  app.get("/api/meta", {
    response: jsonObjectSchema<{ country: string }>("request metadata"),
  }, async () => {
    const headers = currentRequestContext()?.inboundHeaders || {};
    const detected = (
      headerValue(headers, "cf-ipcountry")
      || headerValue(headers, "x-vercel-ip-country")
      || ""
    ).toUpperCase();
    const supported = new Set(["NZ", "AU", "US", "CA", "GB"]);
    return { country: supported.has(detected) ? detected : "ANY" };
  });

  app.get("/api/search", {
    query: SearchQuerySchema,
    response: jsonObjectSchema<SearchResponse>("search response"),
  }, async ({ query }) => {
    const [externalResult, communityResult] = await Promise.allSettled([
      search.post<ExternalSearchResponse>("/search", {
        key: query.raw,
        body: query,
      }),
      community.post<CommunitySearchResponse>("/search", {
        key: query.raw,
        body: query,
      }),
    ]);

    const external = externalResult.status === "fulfilled"
      ? externalResult.value
      : {
          plan: planQuery(query.raw),
          items: [] as WorkItem[],
          sources: unavailableSources(),
        };

    const local = communityResult.status === "fulfilled"
      ? communityResult.value
      : {
          items: [] as WorkItem[],
          source: {
            name: "WorkScout Community",
            ok: false,
            count: 0,
            error: communityResult.status === "rejected"
              ? String(communityResult.reason)
              : "Community service unavailable",
          },
        };

    const items = dedupeWorkItems([
      ...local.items,
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
        local.source,
      ],
    };
  });

  app.post("/api/posts", {
    body: PostInputSchema,
    response: {
      201: jsonObjectSchema<Record<string, unknown>>("post created"),
      429: jsonObjectSchema<ApiError>("post rate limit"),
      503: jsonObjectSchema<ApiError>("community unavailable"),
    },
  }, async ({ body }) => {
    if (String(body.website || "").trim()) {
      return created({ ok: true });
    }

    try {
      const result = await community.post<PostCreated>("/posts", {
        body: {
          post: body,
          fingerprint: fingerprint(currentRequestContext()?.inboundHeaders || {}),
        },
      });
      return created(result);
    } catch (error) {
      if (error instanceof MeshHttpError && error.statusCode === 429) {
        return reply(429, {
          error: "Too many posts from this connection. Try again later.",
        });
      }
      return reply(503, {
        error: "Posting service is temporarily unavailable.",
      });
    }
  });

  app.get("/api/posts", {
    response: jsonObjectSchema<{ items: unknown[] }>("community post list"),
  }, async () => {
    try {
      return await community.get<{ items: unknown[] }>("/posts");
    } catch {
      return { items: [] };
    }
  });

  app.get("/", () => ({
    name: "WorkScout API",
    runtime: "OpenMesh",
    endpoints: ["/api/health", "/api/meta", "/api/search", "/api/posts"],
  }));

  return {
    app,
    search,
    community,
    async listen() {
      return app.listen({ host, port });
    },
  };
}
