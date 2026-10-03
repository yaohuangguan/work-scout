import openmesh from "openmesh-node";
import {
  ControlClient,
  controlPlane,
} from "openmesh-node/services";
import { createCommunityService } from "./community-service";
import { createGateway } from "./gateway";
import { addressUrl } from "./runtime";
import { createSearchService } from "./search-service";

export type WorkScoutTopologyOptions = {
  host?: string;
  gatewayHost?: string;
  controlPort?: number;
  searchPort?: number;
  communityPort?: number;
  gatewayPort?: number;
  controlToken?: string;
  databasePath?: string;
  externalSearch?: boolean;
};

export async function startWorkScoutTopology(
  options: WorkScoutTopologyOptions = {},
) {
  const host = options.host || "127.0.0.1";
  const gatewayHost = options.gatewayHost || host;
  const controlToken = options.controlToken || "workscout-local-control-token";

  const control = openmesh()
    .register(controlPlane({ token: controlToken }))
    .get("/health", () => ({
      ok: true,
      service: "workscout-control",
    }));

  let registrationClient: ControlClient | null = null;
  let search: ReturnType<typeof createSearchService> | null = null;
  let community: ReturnType<typeof createCommunityService> | null = null;
  let gateway: ReturnType<typeof createGateway> | null = null;

  try {
    const controlAddress = await control.listen({
      host,
      port: options.controlPort ?? 8790,
    });
    const controlBaseUrl = addressUrl(controlAddress);
    const controlUrl = controlBaseUrl + "/_mesh";

    registrationClient = new ControlClient({
      url: controlUrl,
      token: controlToken,
      timeout: 5_000,
    });

    search = createSearchService({
      client: registrationClient,
      host,
      port: options.searchPort ?? 8791,
      externalSearch: options.externalSearch ?? true,
    });

    community = createCommunityService({
      client: registrationClient,
      host,
      port: options.communityPort ?? 8792,
      databasePath: options.databasePath,
    });

    const searchAddress = await search.listen();
    const communityAddress = await community.listen();

    gateway = createGateway({
      controlUrl,
      controlToken,
      host: gatewayHost,
      port: options.gatewayPort ?? 8787,
    });
    const gatewayAddress = await gateway.listen();

    const addresses = {
      control: controlBaseUrl,
      search: addressUrl(searchAddress),
      community: addressUrl(communityAddress),
      gateway: addressUrl(gatewayAddress),
    };

    let closing: Promise<void> | null = null;
    const close = () => closing || (closing = (async () => {
      await gateway?.app.close().catch(() => {});
      await community?.app.close().catch(() => {});
      await search?.app.close().catch(() => {});
      await registrationClient?.close().catch(() => {});
      await control.close().catch(() => {});
    })());

    return {
      control,
      registrationClient,
      search,
      community,
      gateway,
      addresses,
      close,
    };
  } catch (error) {
    await gateway?.app.close().catch(() => {});
    await community?.app.close().catch(() => {});
    await search?.app.close().catch(() => {});
    await registrationClient?.close().catch(() => {});
    await control.close().catch(() => {});
    throw error;
  }
}
