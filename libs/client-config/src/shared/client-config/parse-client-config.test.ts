import { describe, expect, test } from 'bun:test';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import {
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  parseClientConfigRows,
} from '@libs/client-config/public/parse-client-config';

describe('parseClientConfigRows', () => {
  test('defaults when empty', () => {
    expect(parseClientConfigRows([])).toEqual(DEFAULT_CLIENT_RUNTIME_CONFIG);
  });

  test('parses flat capability and google keys', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.googleEnabled,
        value: true,
        deleted_at: null,
      },
      {
        id: ClientConfigKey.googleWebClientId,
        value: 'abc.apps.googleusercontent.com',
        deleted_at: null,
      },
      {
        id: ClientConfigKey.billingEnabled,
        value: false,
        deleted_at: null,
      },
    ]);
    expect(config.google_enabled).toBe(true);
    expect(config.google_web_client_id).toBe('abc.apps.googleusercontent.com');
    expect(config.billing_enabled).toBe(false);
    expect(config.tts_enabled).toBe(false);
  });

  test('coerces SQLite integer booleans and JSON string values', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.googleEnabled,
        value: 1,
        deleted_at: null,
      },
      {
        id: ClientConfigKey.googleWebClientId,
        value: '"abc.apps.googleusercontent.com"',
        deleted_at: null,
      },
      {
        id: ClientConfigKey.llmEnabled,
        value: 0,
        deleted_at: null,
      },
    ]);
    expect(config.google_enabled).toBe(true);
    expect(config.google_web_client_id).toBe('abc.apps.googleusercontent.com');
    expect(config.llm_enabled).toBe(false);
  });

  test('treats omitted deleted_at as live (null → undefined)', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.googleEnabled,
        value: 'true',
        deleted_at: undefined as unknown as string | null,
      },
    ]);
    expect(config.google_enabled).toBe(true);
  });

  test('ignores soft-deleted rows', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.googleEnabled,
        value: true,
        deleted_at: '2020-01-01T00:00:00.000Z',
      },
      {
        id: ClientConfigKey.googleWebClientId,
        value: 'x',
        deleted_at: '2020-01-01T00:00:00.000Z',
      },
    ]);
    expect(config.google_enabled).toBe(false);
    expect(config.google_web_client_id).toBeNull();
  });

  test('parses emqx scalar', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.emqxWssUrl,
        value: 'ws://127.0.0.1:8083/mqtt',
        deleted_at: null,
      },
    ]);
    expect(config.emqx_wss_url).toBe('ws://127.0.0.1:8083/mqtt');
  });
});
