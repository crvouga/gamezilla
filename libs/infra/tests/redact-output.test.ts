import { expect, test } from 'bun:test';
import { redactInfraOutput } from '@libs/infra/public/redact-output';

// regression: infra-plan-credential-output
test('a plan containing report and broker access identifiers never logs those credentials', () => {
  const output =
    '+ access_key_id = "report-access-123"\n+ broker_key = "iot-access-456"\nError: Infisical HTTP 403 invalid signature';
  const safe = redactInfraOutput(output, {
    REPORTS_ACCESS_KEY_ID: 'report-access-123',
    IOT_ACCESS_KEY_ID: 'iot-access-456',
  });
  expect(safe).not.toContain('report-access-123');
  expect(safe).not.toContain('iot-access-456');
  expect(safe).toContain('Error: Infisical HTTP 403 invalid signature');
});

test('fresh provider credentials are hidden before they enter the environment', () => {
  expect(
    redactInfraOutput(
      '+ access_key_id = "AKIA1234567890123456"\n+ session_token = "fresh-session"',
      {}
    )
  ).toBe('+ access_key_id = "[redacted]"\n+ session_token = "[redacted]"');
});

test('redaction keeps resource addresses, exit status and the failed operation', () => {
  const output =
    'module.secrets.data.infisical_secrets.current: read\ntofu plan exited 1: HTTP 403';
  expect(redactInfraOutput(output, { INFISICAL_TOKEN: 'private-value' })).toBe(
    output
  );
});
