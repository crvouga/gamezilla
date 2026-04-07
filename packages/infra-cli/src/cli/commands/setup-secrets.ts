import { createInterface } from 'node:readline/promises';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, ok, info, fail, fmt } from '../fmt';
import {
  getSecretMap,
  dopplerSecretExists,
  setDopplerSecret,
  validateSecret,
} from '../secrets';

/**
 * Interactive command that checks which Doppler secrets are missing and
 * prompts the operator to provide values for each one.
 */
export class SetupSecretsCommand implements Command {
  readonly id = 'secrets-setup';
  readonly summary = 'Check for missing Doppler secrets and set them interactively';

  constructor(private readonly _platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Setup Doppler Secrets');

    const secrets = getSecretMap();
    const missing = secrets.filter((s) => !dopplerSecretExists(s.doppler));

    if (missing.length === 0) {
      ok('all secrets present', `${secrets.length}/${secrets.length} configured`);
      return;
    }

    info(
      'status',
      `${missing.length} of ${secrets.length} secrets missing`,
    );

    for (const s of secrets) {
      const exists = !missing.includes(s);
      if (exists) {
        ok(s.doppler, 'already set');
      } else {
        fail(s.doppler, 'missing');
      }
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
      console.log('');
      info('tip', 'leave blank to skip a secret');
      let set = 0;

      for (const s of missing) {
        console.log('');
        console.log(`  ${fmt.bold(s.doppler)}`);
        console.log(`  ${fmt.dim(s.hint)}`);
        const value = await rl.question(`  ${fmt.cyan('value:')} `);
        const trimmed = value.trim();

        if (trimmed === '') {
          info(s.doppler, 'skipped');
          continue;
        }

        const error = await validateSecret(s, trimmed);
        if (error !== null) {
          fail(s.doppler, error);
          continue;
        }

        setDopplerSecret(s.doppler, trimmed);
        ok(s.doppler, 'saved to Doppler');
        set++;
      }

      console.log('');
      info('done', `${set} secret(s) added, ${missing.length - set} skipped`);
    } finally {
      rl.close();
    }
  }
}
