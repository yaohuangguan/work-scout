import { startWorkScoutTopology } from "./topology";

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

const topology = await startWorkScoutTopology({
  host: process.env.WORKSCOUT_INTERNAL_HOST || "127.0.0.1",
  gatewayHost: process.env.WORKSCOUT_HOST || "0.0.0.0",
  controlPort: numberEnv("WORKSCOUT_CONTROL_PORT", 8790),
  searchPort: numberEnv("WORKSCOUT_SEARCH_PORT", 8791),
  communityPort: numberEnv("WORKSCOUT_COMMUNITY_PORT", 8792),
  gatewayPort: numberEnv("PORT", numberEnv("WORKSCOUT_GATEWAY_PORT", 8787)),
  controlToken: process.env.WORKSCOUT_CONTROL_TOKEN || "workscout-local-control-token",
  databasePath: process.env.WORKSCOUT_DB_PATH,
  externalSearch: process.env.WORKSCOUT_EXTERNAL_SEARCH !== "false",
});

console.log("WorkScout OpenMesh topology is ready");
console.log("  gateway:   " + topology.addresses.gateway);
console.log("  search:    " + topology.addresses.search);
console.log("  community: " + topology.addresses.community);
console.log("  control:   " + topology.addresses.control);

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log("Stopping WorkScout (" + signal + ")...");
  await topology.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void stop(signal).finally(() => process.exit(0));
  });
}
