import { DopplerCli } from '@pkgs/doppler/doppler-cli';
import { STRIPE_CLI_LOG_TAG } from './constants';

export function resolveDopplerConfigName(): string {
  const fromEnv = process.env['DOPPLER_CONFIG']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return new DopplerCli().tryConfigureGetConfigPlain() ?? '';
}

/** Exit unless Doppler is scoped to `dev` (never write webhook secrets to prd). */
export function exitUnlessDevDopplerConfig(config: string): void {
  if (config === 'dev') return;
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] Refusing to write STRIPE_WEBHOOK_SECRET: Doppler config must be \`dev\` (got ${config.length > 0 ? JSON.stringify(config) : 'empty'}). ` +
      'Set DOPPLER_CONFIG=dev or run `doppler setup` for this repo.'
  );
  process.exit(1);
}
