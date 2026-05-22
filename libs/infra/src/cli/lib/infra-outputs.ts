import { PROJECT_CONFIG } from '../../project-config';
import type { InfraContext } from '../resources/types';

export interface InfraOutputs {
  readonly client_url: string;
  readonly api_url: string;
  readonly pages_project_name: string;
  readonly pages_subdomain: string;
  readonly cloudflare_nameservers: string;
}

export function infraOutputs(ctx: InfraContext): InfraOutputs {
  const d = PROJECT_CONFIG.domain;
  return {
    client_url: `https://www.${d}`,
    api_url: `https://api.${d}`,
    pages_project_name: PROJECT_CONFIG.cloudflare.clientPagesProject,
    pages_subdomain:
      ctx.pagesSubdomain ??
      `${PROJECT_CONFIG.cloudflare.clientPagesProject}.pages.dev`,
    cloudflare_nameservers: (ctx.nameservers ?? []).join(', '),
  };
}
