import { cfAccountId } from './secrets/cloudflare';

export const WRANGLER_ENV = 'production';

export function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
  };
}

export function wranglerArgs(...args: string[]): string[] {
  return ['--env', WRANGLER_ENV, ...args];
}
