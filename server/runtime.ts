import type { AddressInfo } from "node:net";
import { ControlClient } from "openmesh-node/services";

export type ServiceRuntimeConfig = {
  controlUrl: string;
  controlToken: string;
  host: string;
  port: number;
};

export function addressUrl(address: AddressInfo | string | null, protocol = "http") {
  if (!address || typeof address === "string") {
    throw new Error("WorkScout services require an IP listener");
  }
  return `${protocol}://127.0.0.1:${address.port}`;
}

export function controlClient(controlUrl: string, token: string) {
  return new ControlClient({
    url: controlUrl,
    token,
    timeout: 5_000,
  });
}

export const EXTERNAL_SOURCE_NAMES = [
  "Reddit r/forhire",
  "HN Freelance",
  "Himalayas",
  "Remote OK",
  "Remotive",
] as const;
