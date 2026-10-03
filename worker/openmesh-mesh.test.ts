import { afterEach, describe, expect, it } from "vitest";
import openmesh from "openmesh-node";
import { bodyParser } from "openmesh-node/plugins";
import {
  ControlClient,
  controlPlane,
  serviceRegistration,
} from "openmesh-node/services";
import { objectSchema } from "./contracts";

type Running = { close(): Promise<void> };
const running: Running[] = [];

afterEach(async () => {
  while (running.length) {
    await running.pop()!.close();
  }
});

function httpUrl(address: { port: number } | string | null) {
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address");
  }
  return `http://127.0.0.1:${address.port}`;
}

describe("WorkScout OpenMesh service discovery", () => {
  it("discovers a service and propagates request context through app.mesh()", async () => {
    const token = "workscout-mesh-test-token";

    const control = openmesh()
      .register(controlPlane({ token }));
    const controlAddress = await control.listen({ host: "127.0.0.1", port: 0 });
    running.push(control);
    const controlUrl = httpUrl(controlAddress) + "/_mesh";

    const registrationClient = new ControlClient({
      url: controlUrl,
      token,
      timeout: 5_000,
    });
    running.push(registrationClient);

    const search = openmesh({ service: "search" })
      .use(bodyParser())
      .register(serviceRegistration({
        client: registrationClient,
        service: "search",
        id: "search-v1-nz",
        ttl: 5_000,
        metadata: {
          version: "v1",
          region: "nz",
        },
        url: (address) => httpUrl(address),
      }))
      .post("/probe", {
        body: objectSchema<{ term: string }>("mesh probe body"),
        response: objectSchema<{
          term: string;
          instance: string;
          requestId: string | null;
        }>("mesh probe response"),
      }, async ({ body, state }) => ({
        term: body.term,
        instance: "search-v1-nz",
        requestId: typeof state.requestId === "string" ? state.requestId : null,
      }));

    await search.listen({ host: "127.0.0.1", port: 0 });
    running.push(search);

    const gateway = openmesh({
      service: "gateway",
      mesh: {
        control: {
          url: controlUrl,
          token,
          timeout: 5_000,
        },
        services: {
          search: {
            traffic: {
              split: [
                {
                  match: { version: "v1", region: "nz" },
                  weight: 100,
                },
              ],
              fallback: "error",
            },
          },
        },
      },
    });

    const searchService = gateway.mesh("search");

    gateway.get("/probe", {
      response: objectSchema<{
        term: string;
        instance: string;
        requestId: string | null;
      }>("gateway mesh probe response"),
    }, async () => searchService.post("/probe", {
      key: "react-node",
      body: { term: "React Node" },
    }));

    const gatewayAddress = await gateway.listen({ host: "127.0.0.1", port: 0 });
    running.push(gateway);

    const peers = await searchService.stats();
    expect(peers).toHaveLength(1);
    expect(peers[0]?.id).toBe("search-v1-nz");

    const response = await fetch(httpUrl(gatewayAddress) + "/probe", {
      headers: {
        "x-request-id": "workscout-mesh-request",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      term: "React Node",
      instance: "search-v1-nz",
      requestId: "workscout-mesh-request",
    });
  });
});
