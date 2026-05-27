import type { execSync } from 'node:child_process';
import { describe, expect, it } from 'bun:test';
import { DopplerCli } from '@pkgs/doppler/doppler-cli';
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
    expect((await store.getRequired('FOO')).readSecretValue()).toBe('bar');
    expect((await store.getOptional('FOO'))?.readSecretValue()).toBe('bar');
    const req = await store.getRequiredMany(['FOO']);
    expect(req['FOO']?.readSecretValue()).toBe('bar');
    const opt = await store.getOptionalMany(['FOO', 'MISSING']);
    expect(opt['FOO']?.readSecretValue()).toBe('bar');
    expect(opt['MISSING']).toBeNull();
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
