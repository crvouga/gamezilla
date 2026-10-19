import { expect, test } from 'bun:test';
import { transferDiagnostic } from './verify-artifact-download';
import { decodePlan, encodePlan } from './verify-plan-transfer';

test('compressed plan transport preserves exact task identities and rejects truncation', () => {
  const files = {
    'plan.json': JSON.stringify({
      version: 2,
      tasks: [{ taskId: '@p/a#test', hash: 'abcd', dependencies: [] }],
      shards: [
        {
          index: 0,
          stage: 'verifications',
          seconds: 5,
          tasks: [{ taskId: '@p/a#test', hash: 'abcd', dependencies: [] }],
        },
      ],
    }),
    'context.json': JSON.stringify({ secretsRange: 'a..b' }),
  };
  const payload = encodePlan(files);
  expect(decodePlan(payload)).toEqual(files);
  expect(() => decodePlan(payload.slice(0, -12))).toThrow();
});

// regression: verify-artifact-download-encoded-credentials
test('artifact diagnostics redact credentials inside an encoded proxy URL', () => {
  const signed =
    'https://store.invalid/object?X-Amz-Security-Token=fake-credential';
  const proxy = `http://127.0.0.1:1978/download/${Buffer.from(signed).toString('base64')}`;
  expect(transferDiagnostic(`Redirecting to blob download url: ${proxy}`)).toBe(
    'Redirecting to blob download url: [transfer-url-redacted]'
  );
  expect(transferDiagnostic(`download failed: ${signed}`)).not.toContain(
    'fake-credential'
  );
});
