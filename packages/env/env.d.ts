/* oxlint-disable typescript/no-empty-interface, typescript/no-empty-object-type, no-empty-interface, no-empty-object-type */
import type { ServerEnv } from "@ppal/infra/alchemy.run";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/cloudflare/compute/workers

export type CloudflareEnv = ServerEnv;

declare global {
  type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    // oxlint-disable-next-line typescript(no-empty-interface), typescript(no-empty-object-type) -- Interface augmentation for Cloudflare Workers
    export interface Env extends CloudflareEnv {}
  }
}
