import { describe, expect, test } from 'bun:test';
import {
  fillUnsetEnv,
  OBS_QUERY_KEYS,
  productionQueryRequested,
} from '@libs/secrets-shared/obs-query-env';

describe('production query credentials', () => {
  test('a production trace source or platform query asks for query credentials', () => {
    expect(productionQueryRequested(['person', '--source', 'prod'])).toBe(true);
    expect(productionQueryRequested(['platform', '--service', 'example'])).toBe(
      true
    );
    expect(productionQueryRequested(['last', '--source', 'tempo'])).toBe(true);
    expect(productionQueryRequested(['last', '--source=prod'])).toBe(true);
    expect(productionQueryRequested(['last'])).toBe(false);
    expect(
      productionQueryRequested(['last', '--source', '.observability'])
    ).toBe(false);
  });

  test('fills missing query keys and leaves an owner url and a set token alone', () => {
    const env: Record<string, string | undefined> = {
      OBS_TEMPO_TOKEN: 'already',
      DATABASE_URL: 'postgresql://owner:secret@db/neondb',
      GRAFANA_CLOUD_API_TOKEN: 'admin',
    };
    fillUnsetEnv(
      env,
      new Map([
        ['OBS_TEMPO_URL', 'https://tempo.example'],
        ['OBS_TEMPO_USER', 'stack'],
        ['OBS_TEMPO_TOKEN', 'replacement'],
        ['OBS_READONLY_DATABASE_URL', 'postgresql://obs_read:secret@db/neondb'],
        ['DATABASE_URL', 'postgresql://owner:other@db/neondb'],
      ]),
      OBS_QUERY_KEYS
    );
    expect(env['OBS_TEMPO_URL']).toBe('https://tempo.example');
    expect(env['OBS_TEMPO_USER']).toBe('stack');
    expect(env['OBS_TEMPO_TOKEN']).toBe('already');
    expect(env['OBS_READONLY_DATABASE_URL']).toContain('obs_read');
    expect(env['DATABASE_URL']).toContain('owner:secret');
    expect(env['GRAFANA_CLOUD_API_TOKEN']).toBe('admin');
  });
});
