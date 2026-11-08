import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  assertEvidencePath,
  decodeEvidence,
  EVIDENCE_MANIFEST,
  encodeEvidence,
  STORYBOOK_RESULTS,
  validateEvidenceManifest,
} from './storybook-evidence-log';

// regression: retained-storybook-evidence-inaccessible
test('retained Word Tiles browser evidence can be exported without local secrets', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(
      new URL('../../../.github/workflows/verify-nightly.yml', import.meta.url),
      'utf8'
    )
  ) as { on: { workflow_dispatch: { inputs: Record<string, unknown> } } };
  expect(workflow.on.workflow_dispatch.inputs).toHaveProperty(
    'storybook-evidence-run'
  );
});

test('evidence export cannot execute browser builds or author reference images', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(
      new URL('../../../.github/workflows/verify-nightly.yml', import.meta.url),
      'utf8'
    )
  ) as { jobs: Record<string, { steps: { name: string; if?: string }[] }> };
  for (const name of [
    'Prepare Storybook renderer',
    'Build canonical Storybook',
    'Author references explicitly',
    'Compare every authored Storybook state',
    'Compare PR Storybook states',
  ])
    expect(
      workflow.jobs['verify-nightly-storybook']?.steps.find(
        (step) => step.name === name
      )?.if
    ).toContain('!inputs.storybook-evidence-run');
});

test('binary recordings round trip through masked and timestamped logs', () => {
  const path = `${STORYBOOK_RESULTS}word-tiles/video.webm`;
  const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
  const log = encodeEvidence(path, bytes)
    .split('\n')
    .map((line) => `2026-11-08T00:00:00Z ${line}`)
    .join('\n')
    .replaceAll('1', '***');
  expect(decodeEvidence(log)).toMatchObject({ path, bytes });
});

test('exports reject secrets, traversal, executable files and other artifact roots', () => {
  for (const path of [
    '.env',
    `${STORYBOOK_RESULTS}../secrets.json`,
    `${STORYBOOK_RESULTS}x/../../secrets.json`,
    `${STORYBOOK_RESULTS}x\\secrets.json`,
    `${STORYBOOK_RESULTS}run.ts`,
    'verify-plan/plan.json',
  ])
    expect(() => assertEvidencePath(path)).toThrow();
});

test('truncated evidence cannot be mistaken for a complete recording', () => {
  const log = encodeEvidence(`${STORYBOOK_RESULTS}a.png`, new Uint8Array([1]));
  expect(() => decodeEvidence(log.slice(0, -1))).toThrow();
});

test('a final manifest is required and binds every decoded file', () => {
  const file = encodeEvidence(`${STORYBOOK_RESULTS}a.png`, new Uint8Array([1]));
  const record = decodeEvidence(file);
  const manifest = encodeEvidence(
    EVIDENCE_MANIFEST,
    Buffer.from(JSON.stringify({ runId: '42433806308', files: [record] }))
  );
  expect(validateEvidenceManifest(decodeEvidence(manifest), [record])).toBe(
    '42433806308'
  );
  expect(() => validateEvidenceManifest(undefined, [record])).toThrow(
    'incomplete'
  );
  expect(() => validateEvidenceManifest(decodeEvidence(manifest), [])).toThrow(
    'does not match'
  );
  expect(() =>
    validateEvidenceManifest(decodeEvidence(manifest), [record, record])
  ).toThrow();
});
