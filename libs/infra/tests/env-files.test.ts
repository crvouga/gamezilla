import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  authRelayTargets,
  envHostnames,
  envOrigins,
  sharedIdentities,
} from '@libs/infra/public/env-file';
import { ENV_FILES } from '@libs/infra/public/envs';
import { GLOBAL } from '@libs/infra/public/global';
import { envResourceNames } from '@libs/infra/public/naming';

const ENVS_DIR = join(import.meta.dirname, '../tofu/envs');

describe('environment files', () => {
  test('every file in tofu/envs is registered and named after its env', () => {
    const files = readdirSync(ENVS_DIR)
      .filter((f) => f.endsWith('.tfvars.json'))
      .map((f) => f.replace('.tfvars.json', ''))
      .sort();
    expect(Object.keys(ENV_FILES).sort()).toEqual(files);
    for (const [name, env] of Object.entries(ENV_FILES)) {
      expect(env.env).toBe(name);
    }
  });

  test('the OAuth relay forwards to every environment and to nothing else', () => {
    const envs = Object.values(ENV_FILES);
    expect(authRelayTargets(envs)).toEqual(
      Object.fromEntries(envs.map((env) => [env.env, envOrigins(env).api]))
    );
  });

  test('the OAuth relay has its own hostname under the zone, no environment claims it', () => {
    const relay = GLOBAL.auth_relay;
    expect(relay.hostname.endsWith(`.${relay.zone_name}`)).toBe(true);
    expect(
      relay.hostname.slice(0, -(relay.zone_name.length + 1))
    ).not.toContain('.');
    for (const env of Object.values(ENV_FILES)) {
      expect(envHostnames(env)).not.toContain(relay.hostname);
      expect(Object.values(envResourceNames(env))).not.toContain(relay.worker);
    }
  });

  test('a standard environment adopts nothing, so it can be torn down and rebuilt', () => {
    for (const env of Object.values(ENV_FILES)) {
      if (env.protection !== 'standard') continue;
      expect({ env: env.env, imports: env.imports }).toEqual({
        env: env.env,
        imports: undefined,
      });
    }
  });

  test('no two environments share a stateful identity or hostname', () => {
    expect(sharedIdentities(Object.values(ENV_FILES))).toEqual([]);
  });

  test('no two environments share a physical resource name', () => {
    const seen = new Map<string, string>();
    for (const env of Object.values(ENV_FILES)) {
      for (const name of Object.values(envResourceNames(env))) {
        expect(seen.get(name) ?? env.env).toBe(env.env);
        seen.set(name, env.env);
      }
    }
  });

  test('every hostname sits one level under the zone (Universal SSL coverage)', () => {
    for (const env of Object.values(ENV_FILES)) {
      for (const host of envHostnames(env)) {
        const zone = env.cloudflare.zone_name;
        const label = host === zone ? '' : host.slice(0, -(zone.length + 1));
        expect({
          host,
          ok:
            host === zone ||
            (host.endsWith(`.${zone}`) && !label.includes('.')),
        }).toEqual({ host, ok: true });
      }
    }
  });

  // regression: legacy prd names — the cutover must adopt, never rename
  test('prd preserves its data resources and adopts the existing room storage', () => {
    const prd = ENV_FILES['prd'];
    expect(prd).toBeDefined();
    if (prd === undefined) return;
    const names = envResourceNames(prd);
    expect(names.worker).toBe('gamezilla-prod');
    expect(prd.worker.transfer_rooms_from).toBe('gamezilla-room-production');
    expect(names.bucket).toBe('gamezilla-production');
  });

  // regression: grafana-stack-in-foreign-org
  test('the shared Grafana stack is the one the token org owns, adopted not created', () => {
    expect(GLOBAL.grafana.stack_slug).toBe('shortawning2091');
    expect(GLOBAL.global_imports?.grafana_stack).toBe('shortawning2091');
  });
});
