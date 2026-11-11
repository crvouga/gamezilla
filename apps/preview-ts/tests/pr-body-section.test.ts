import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  PREVIEW_SECTION_END,
  PREVIEW_SECTION_START,
  type PreviewSectionFacts,
  previewUrlInBody,
  renderPreviewSection,
  upsertPreviewSection,
} from '../src/pr-body-section';

const facts: PreviewSectionFacts = {
  pr: 12,
  status: 'live',
  url: 'https://pr-12-acme-preview.acme.workers.dev',
  deployedSha: 'a'.repeat(40),
  attemptedSha: 'a'.repeat(40),
  runUrl: 'https://github.com/acme/app/actions/runs/1',
  detail: null,
};

// The author's text: anything that does not itself spell a marker.
const authored = fc
  .string({ maxLength: 400 })
  .filter(
    (text) =>
      !text.includes(PREVIEW_SECTION_START) &&
      !text.includes(PREVIEW_SECTION_END)
  );

test('the section names the URL, commit, status, sign-in, reset and diagnostics', () => {
  const section = renderPreviewSection(facts);
  expect(section.startsWith(PREVIEW_SECTION_START)).toBe(true);
  expect(section.endsWith(PREVIEW_SECTION_END)).toBe(true);
  expect(section).toContain(facts.url ?? '');
  expect(section).toContain('aaaaaaaaaaaa');
  expect(section).toContain('🟢 live');
  expect(section).toContain('**Sign in:**');
  expect(section).toContain('**Reset:**');
  expect(section).toContain('PREVIEW_PR=12 mise run preview:test');
  expect(section).toContain(facts.runUrl ?? '');
});

test('a failed deploy shows the commit still serving beside the one attempted', () => {
  const section = renderPreviewSection({
    ...facts,
    status: 'failed',
    attemptedSha: 'b'.repeat(40),
    detail: 'wrangler preview exited 1',
  });
  expect(section).toContain('| Deployed commit | `aaaaaaaaaaaa` |');
  expect(section).toContain('| Attempted commit | `bbbbbbbbbbbb` |');
  expect(section).toContain('> wrangler preview exited 1');
});

test('a first deploy that fails claims no working version', () => {
  const section = renderPreviewSection({
    ...facts,
    status: 'failed',
    deployedSha: null,
  });
  expect(section).toContain('nothing has been deployed yet');
  expect(section).not.toContain('still serving');
});

test('a removed Preview offers no sign-in', () => {
  const section = renderPreviewSection({
    ...facts,
    status: 'removed',
    url: null,
  });
  expect(section).not.toContain('Sign in');
  expect(previewUrlInBody(section)).toBeNull();
});

test('everything outside the markers survives any number of updates', () => {
  assertProperty(
    'preview section update preserves authored text',
    fc.property(authored, authored, (before, after) => {
      const first = renderPreviewSection(facts);
      const second = renderPreviewSection({ ...facts, status: 'deploying' });
      const body = `${before}${first}${after}`;
      const updated = upsertPreviewSection(body, second);
      expect(updated).toBe(`${before}${second}${after}`);
      expect(upsertPreviewSection(updated, second)).toBe(updated);
    })
  );
});

test('a description without the section gains it after the author’s text', () => {
  assertProperty(
    'preview section appends after authored text',
    fc.property(authored, (body) => {
      const section = renderPreviewSection(facts);
      const updated = upsertPreviewSection(body, section);
      expect(updated.endsWith(section)).toBe(true);
      expect(updated.startsWith(body.replace(/\s+$/, ''))).toBe(true);
      expect(previewUrlInBody(updated)).toBe(facts.url);
      expect(upsertPreviewSection(updated, section)).toBe(updated);
    })
  );
});
