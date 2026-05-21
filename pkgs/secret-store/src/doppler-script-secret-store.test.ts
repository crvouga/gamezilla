import type { execSync } from 'node:child_process';
import { describe, expect, it } from 'bun:test';
import { DopplerCli } from '@gamezilla/doppler/doppler-cli';
import { DopplerSecretStore } from './doppler-secret-store';
import { DopplerScriptSecretStore } from './doppler-script-secret-store';

function makeReader(): DopplerSecretStore {
  return new DopplerSecretStore({
    token: 'dp.st.x',
    fetchFn: () =>
      Promise.resolve(
        new Response(JSON.stringify({ FOO: 'bar' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      ),
  });
}

function makeCli(execCalls: string[]): DopplerCli {
  return new DopplerCli({
    processEnv: {
      DOPPLER_TOKEN: 'dp.st.dummy',
    } as unknown as NodeJS.ProcessEnv,
    execSyncFn: ((cmd: string) => {
      execCalls.push(cmd);
      return Buffer.from('');
    }) as unknown as typeof execSync,
  });
}

describe('DopplerScriptSecretStore', () => {
  it('delegates reads to the wrapped DopplerSecretStore', async () => {
    const store = new DopplerScriptSecretStore(makeReader(), makeCli([]));
    await expect(store.getRequired('FOO')).resolves.toBe('bar');
    await expect(store.getOptional('FOO')).resolves.toBe('bar');
    await expect(store.getRequiredMany(['FOO'])).resolves.toEqual({
      FOO: 'bar',
    });
    await expect(store.getOptionalMany(['FOO', 'MISSING'])).resolves.toEqual({
      FOO: 'bar',
      MISSING: null,
    });
  });

  it('routes setSecret to the Doppler CLI', async () => {
    const calls: string[] = [];
    const store = new DopplerScriptSecretStore(makeReader(), makeCli(calls));
    await store.setSecret('STRIPE_WEBHOOK_SECRET', 'whsec_abc');
    expect(calls).toEqual([
      'doppler secrets set STRIPE_WEBHOOK_SECRET=whsec_abc',
    ]);
  });
});
