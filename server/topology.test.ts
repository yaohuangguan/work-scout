import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startWorkScoutTopology } from "./topology";

const running: Array<{ close(): Promise<void> }> = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (running.length) {
    await running.pop()!.close();
  }
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("WorkScout OpenMesh topology", () => {
  it("runs CRUD/search through real discovery-backed services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "workscout-openmesh-"));
    tempDirs.push(dir);

    const topology = await startWorkScoutTopology({
      host: "127.0.0.1",
      gatewayHost: "127.0.0.1",
      controlPort: 0,
      searchPort: 0,
      communityPort: 0,
      gatewayPort: 0,
      databasePath: join(dir, "workscout.sqlite"),
      externalSearch: false,
      controlToken: "workscout-test-control-token",
    });
    running.push(topology);

    const searchInstances = await topology.registrationClient.discover("search");
    const communityInstances = await topology.registrationClient.discover("community");
    expect(searchInstances).toHaveLength(1);
    expect(communityInstances).toHaveLength(1);

    const health = await fetch(topology.addresses.gateway + "/api/health");
    expect(health.status).toBe(200);
    const healthBody = await health.json() as any;
    expect(healthBody.runtime).toBe("openmesh");
    expect(healthBody.services.search.peers).toBe(1);
    expect(healthBody.services.community.peers).toBe(1);

    const invalidPost = await fetch(topology.addresses.gateway + "/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "x",
        description: "too short",
        contact: "bad",
        skills: "",
      }),
    });
    expect(invalidPost.status).toBe(400);
    expect(typeof ((await invalidPost.json()) as any).error).toBe("string");

    const posted = await fetch(topology.addresses.gateway + "/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.42",
      },
      body: JSON.stringify({
        title: "Build a WorkScout OpenMesh integration",
        company: "WorkScout QA",
        description: "Implement and verify a real OpenMesh backed WorkScout business workflow.",
        skills: "OpenMeshNeedle2026, TypeScript",
        workType: "Contract",
        locationScope: "Worldwide",
        budget: "NZD 500",
        contact: "qa@example.com",
        website: "",
      }),
    });

    expect(posted.status).toBe(201);
    const postedBody = await posted.json() as any;
    expect(postedBody.ok).toBe(true);
    expect(typeof postedBody.id).toBe("string");

    const searchUrl = new URL(topology.addresses.gateway + "/api/search");
    searchUrl.searchParams.set("q", "OpenMeshNeedle2026");
    searchUrl.searchParams.set("country", "NZ");
    searchUrl.searchParams.set("countryLabel", "New Zealand");
    searchUrl.searchParams.set("hours", "20");
    searchUrl.searchParams.set("types", "contract,part-time,gig");

    const searched = await fetch(searchUrl);
    expect(searched.status).toBe(200);
    const searchBody = await searched.json() as any;

    expect(searchBody.sources).toHaveLength(6);
    expect(searchBody.items.some((item: any) =>
      item.source === "WorkScout" &&
      item.title === "Build a WorkScout OpenMesh integration"
    )).toBe(true);

    const posts = await fetch(topology.addresses.gateway + "/api/posts");
    expect(posts.status).toBe(200);
    const postsBody = await posts.json() as any;
    expect(postsBody.items.some((post: any) => post.id === postedBody.id)).toBe(true);
    expect(postsBody.items[0]).not.toHaveProperty("contact");
  }, 20_000);
});
