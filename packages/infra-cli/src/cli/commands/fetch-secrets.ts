import { appendFileSync } from 'node:fs';
import { banner, fail, info, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  fetchDopplerSecret,
  getSecretMap,
  validateSecret,
} from '../secrets/secrets';
import type { Command } from './types';

/**
 * Fetches all required secrets from Doppler and exports them.
 *
 * - In GitHub Actions (`$GITHUB_ENV` is set): writes to `$GITHUB_ENV` so
 *   subsequent steps see the variables.
 * - Locally: prints KEY=VALUE lines to stdout.
 */
export class FetchSecretsCommand implements Command {
  readonly id = 'secrets-fetch';
  readonly summary = 'Fetch secrets from Doppler and export as env vars';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const ghEnvPath = process.env['GITHUB_ENV'];
    const isCI = ghEnvPath !== undefined && ghEnvPath !== '';

    if (!isCI) banner('Fetch Secrets from Doppler');

    const secrets = getSecretMap();
    let failed = 0;

    for (const secret of secrets) {
      const { doppler, env } = secret;
      try {
        const value = fetchDopplerSecret(doppler);

        const error = await validateSecret(secret, value);
        if (error !== null) {
          if (!isCI) fail(env, `invalid — ${error}`);
          else this.platform.warning(`${doppler} invalid: ${error}`);
          failed++;
          continue;
        }

        process.env[env] = value;

        if (isCI) {
          const delimiter = `INFRA_EOF_${env}`;
          appendFileSync(
            ghEnvPath,
            `${env}<<${delimiter}\n${value}\n${delimiter}\n`
          );
        } else {
          console.log(`${env}=${value}`);
        }

        if (!isCI) ok(env, 'fetched');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isCI) fail(env, msg);
        else this.platform.warning(`Failed to fetch ${doppler}: ${msg}`);
        failed++;
      }
    }

    if (!isCI) info('total', `${secrets.length} secrets, ${failed} failed`);

    if (failed > 0) {
      throw new Error(`${failed} secret(s) could not be fetched from Doppler`);
    }
  }
}
