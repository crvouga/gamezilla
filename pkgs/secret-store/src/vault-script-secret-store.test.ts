import type { execSync } from 'node:child_process';
import { describe, expect, it } from 'bun:test';
import { VaultCli } from '@pkgs/vault/vault-cli';
import { VaultSecretStore } from './vault-secret-store';
import { VaultScriptSecretStore } from './vault-script-secret-store';

function makeReader(): VaultSecretStore {
  return new VaultSecretStore({
    token: 'hvs.x',
    config: 'dev',
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: { data: { FOO: 'bar' }, metadata: { version: 1 } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      ),
  });
}

function makeCli(execCalls: string[]): VaultCli {
  return new VaultCli({
    processEnv: {
      VAULT_TOKEN: 'hvs.dummy',
      VAULT_CONFIG: 'dev',
    } as unknown as NodeJS.ProcessEnv,
    execSyncFn: ((cmd: string) => {
      execCalls.push(cmd);
      return Buffer.from('');
    }) as unknown as typeof execSync,
  });
}

describe('VaultScriptSecretStore', () => {
  it('delegates reads to the wrapped VaultSecretStore', async () => {
    const store = new VaultScriptSecretStore(makeReader(), makeCli([]));
    expect((await store.getRequired('FOO')).readSecretValue()).toBe('bar');
    expect((await store.getOptional('FOO'))?.readSecretValue()).toBe('bar');
    const req = await store.getRequiredMany(['FOO']);
    expect(req['FOO']?.readSecretValue()).toBe('bar');
    const opt = await store.getOptionalMany(['FOO', 'MISSING']);
    expect(opt['FOO']?.readSecretValue()).toBe('bar');
    expect(opt['MISSING']).toBeNull();
  });

  it('routes setSecret to the Vault CLI', async () => {
    const calls: string[] = [];
    const store = new VaultScriptSecretStore(makeReader(), makeCli(calls));
    await store.setSecret('STRIPE_WEBHOOK_SECRET', 'whsec_abc');
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('vault kv patch');
    expect(calls[0]).toContain('STRIPE_WEBHOOK_SECRET=whsec_abc');
  });
});
