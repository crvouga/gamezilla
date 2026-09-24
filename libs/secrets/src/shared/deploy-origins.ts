import { PRODUCT_CONFIG } from '@libs/db/public/product-config';

/** Canonical production web origin (static SPA on www). */
export function productionClientOrigin(): string {
  return `https://www.${PRODUCT_CONFIG.domain}`;
}

/** Canonical production API origin (Hono Worker on api.). */
export function productionApiOrigin(): string {
  return `https://api.${PRODUCT_CONFIG.domain}`;
}

/** Canonical production EMQX origin (Railway + Caddy). */
export function productionEmqxOrigin(): string {
  return `https://${PRODUCT_CONFIG.emqx.hostname}`;
}
