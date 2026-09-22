import { describe, expect, test } from 'bun:test';

const CONFIG_ROOT = new URL('../configs/', import.meta.url);
const ROOM_ATTRIBUTES = [
  'app.room.connection_id',
  'app.room.message_bytes',
  'app.room.module',
  'app.room.outcome',
  'app.room.topic',
] as const;

async function config(name: string): Promise<string> {
  return Bun.file(new URL(name, CONFIG_ROOT)).text();
}

describe('Collector environment contracts', () => {
  test('CI accepts browser OTLP and writes queryable NDJSON', async () => {
    const text = await config('collector-ci.yaml');
    expect(text).toContain('endpoint: 0.0.0.0:4318');
    expect(text).toContain('http://127.0.0.1:*');
    expect(text).toContain('path: ${env:OBSERVABILITY_ARTIFACT_PATH}');
    expect(text).toContain('append: true');
    expect(text).toContain('transform/allowlist');
    for (const attribute of ROOM_ATTRIBUTES) expect(text).toContain(attribute);
  });

  test('production separates authenticated ingest from backend export', async () => {
    const text = await config('collector-prod.yaml');
    expect(text).toContain('bearertokenauth/ingest');
    expect(text).toContain('${env:OBSERVABILITY_INGEST_TOKEN}');
    expect(text).toContain('${env:OBSERVABILITY_BACKEND_OTLP_ENDPOINT}');
    expect(text).toContain('${env:OBSERVABILITY_BACKEND_AUTHORIZATION}');
    expect(text).toContain('transform/allowlist');
    for (const attribute of ROOM_ATTRIBUTES) expect(text).toContain(attribute);
  });

  test('production alert hands an agent a safe first command', async () => {
    const text = await config('production-error-alert.txt');
    expect(text).toContain('bun obs trace {{ trace_id }} --source prod');
    expect(text).toContain('bun obs errors --since 15m --source prod');
    expect(text).toContain('read-only traces token');
    expect(text).not.toContain('OBSERVABILITY_COLLECTOR_TOKEN');
  });
});
