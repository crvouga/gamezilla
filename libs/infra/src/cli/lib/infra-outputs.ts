import { PROJECT_CONFIG } from '../../project-config';
import type { InfraContext } from '../resources/types';

export interface InfraOutputs {
  readonly client_url: string;
  readonly api_url: string;
  readonly cloudflare_nameservers: string;
}

export function productionOrigin(): string {
  return `https://www.${PROJECT_CONFIG.domain}`;
}

export function infraOutputs(ctx: InfraContext): InfraOutputs {
  const origin = productionOrigin();
  return {
    client_url: origin,
    api_url: origin,
    cloudflare_nameservers: (ctx.nameservers ?? []).join(', '),
  };
}
