import { PRODUCT_CONFIG } from '@libs/db/public/product-config';

/** Canonical production web origin (static SPA on www). */
export function productionClientOrigin(): string {
  return `https://www.${PRODUCT_CONFIG.domain}`;
}

/** Canonical production API origin (Hono Worker on api.). */
export function productionApiOrigin(): string {
  return `https://api.${PRODUCT_CONFIG.domain}`;
}

/** Canonical production Console origin (static SPA on console.). */
export function productionConsoleOrigin(): string {
  return `https://console.${PRODUCT_CONFIG.domain}`;
}

/** Canonical production EMQX origin (Railway + Caddy). */
export function productionEmqxOrigin(): string {
  return `https://${PRODUCT_CONFIG.emqx.hostname}`;
}

export type DeployOutputs = {
  readonly client_url: string;
  readonly api_url: string;
  readonly console_url: string;
  readonly emqx_url: string;
  readonly cloudflare_nameservers: string;
};

export function deployOutputs(nameservers?: readonly string[]): DeployOutputs {
  return {
    client_url: productionClientOrigin(),
    api_url: productionApiOrigin(),
    console_url: productionConsoleOrigin(),
    emqx_url: productionEmqxOrigin(),
    cloudflare_nameservers: (nameservers ?? []).join(', '),
  };
}
