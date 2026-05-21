import { DopplerCli } from '@pkgs/doppler/doppler-cli';
import { STRIPE_CLI_LOG_TAG } from './constants';

export function resolveDopplerConfigName(): string {
  const fromEnv = process.env['DOPPLER_CONFIG']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return new DopplerCli().tryConfigureGetConfigPlain() ?? '';
}

/** Exit unless Doppler is scoped to `local` (never write webhook secrets to prod). */
export function exitUnlessLocalDopplerConfig(config: string): void {
  if (config === 'local') return;
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] Refusing to write STRIPE_WEBHOOK_SECRET: Doppler config must be \`local\` (got ${config.length > 0 ? JSON.stringify(config) : 'empty'}). ` +
      'Set DOPPLER_CONFIG=local or run `doppler setup` for this repo.'
  );
  process.exit(1);
}
