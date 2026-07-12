import { PROJECT_CONFIG } from '../../project-config';
import type { InfraContext } from '../resources/types';

export interface InfraOutputs {
  readonly client_url: string;
  readonly api_url: string;
  readonly cloudflare_nameservers: string;
}

/** Canonical production web origin (static SPA on www). */
export function productionClientOrigin(): string {
  return `https://www.${PROJECT_CONFIG.domain}`;
}

/** Canonical production API origin (Hono Worker on api.). */
export function productionApiOrigin(): string {
  return `https://api.${PROJECT_CONFIG.domain}`;
}

export function infraOutputs(ctx: InfraContext): InfraOutputs {
  return {
    client_url: productionClientOrigin(),
    api_url: productionApiOrigin(),
    cloudflare_nameservers: (ctx.nameservers ?? []).join(', '),
  };
}
