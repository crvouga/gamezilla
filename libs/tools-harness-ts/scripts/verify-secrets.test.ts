import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: secret-scan-installs-unrelated-tools
test('secret scanning resolves its preinstalled pinned tool without toolchain installation', () => {
  const source = readFileSync(
    join(import.meta.dirname, 'verify-secrets.ts'),
    'utf8'
  );
  expect(source).toContain("spawnSync('mise', ['which', 'gitleaks']");
  expect(source).toContain('isAbsolute(executable)');
  expect(source).toContain('spawnSync(\n  executable,');
  expect(source).not.toContain("'exec'");
  expect(source).not.toContain("'install'");
  for (const argument of [
    "'git'",
    "'--redact'",
    "'--exit-code'",
    '`--log-opts=${range}`',
  ])
    expect(source).toContain(argument);
});
