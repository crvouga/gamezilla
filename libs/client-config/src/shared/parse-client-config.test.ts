import { describe, expect, test } from 'bun:test';
import { ClientConfigKey } from '../shared/client-config-keys';
import {
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  parseClientConfigRows,
} from '../shared/parse-client-config';

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
        id: ClientConfigKey.emailPasswordEnabled,
        value: true,
        deleted_at: null,
      },
      {
        id: ClientConfigKey.stripeEnabled,
        value: false,
        deleted_at: null,
      },
    ]);
    expect(config.google_enabled).toBe(true);
    expect(config.google_web_client_id).toBe('abc.apps.googleusercontent.com');
    expect(config.email_password_enabled).toBe(true);
    expect(config.stripe_enabled).toBe(false);
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
        id: ClientConfigKey.emailPasswordEnabled,
        value: 'true',
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
    expect(config.email_password_enabled).toBe(true);
    expect(config.llm_enabled).toBe(false);
  });

  test('treats omitted deleted_at as live (null → undefined)', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.emailPasswordEnabled,
        value: 'true',
        deleted_at: undefined as unknown as string | null,
      },
    ]);
    expect(config.email_password_enabled).toBe(true);
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

  test('parses emqx and observability scalars', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.emqxWssUrl,
        value: 'ws://127.0.0.1:8083/mqtt',
        deleted_at: null,
      },
      {
        id: ClientConfigKey.observabilityBackend,
        value: 'console',
        deleted_at: null,
      },
    ]);
    expect(config.emqx_wss_url).toBe('ws://127.0.0.1:8083/mqtt');
    expect(config.observability_backend).toBe('console');
  });

  test('legacy sentry backend falls back to noop', () => {
    const config = parseClientConfigRows([
      {
        id: ClientConfigKey.observabilityBackend,
        value: 'sentry',
        deleted_at: null,
      },
    ]);
    expect(config.observability_backend).toBe('noop');
  });

  test('observability defaults to noop when missing or invalid', () => {
    expect(parseClientConfigRows([]).observability_backend).toBe('noop');
    const invalid = parseClientConfigRows([
      {
        id: ClientConfigKey.observabilityBackend,
        value: 'not-a-backend',
        deleted_at: null,
      },
    ]);
    expect(invalid.observability_backend).toBe('noop');
  });
});
