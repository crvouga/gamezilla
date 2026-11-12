import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  PREVIEW_SECTION_END,
  PREVIEW_SECTION_START,
  type PreviewSectionFacts,
  previewUrlInBody,
  renderPreviewSection,
  storybookUrlInBody,
  upsertPreviewSection,
} from '../src/pr-body-section';

const facts: PreviewSectionFacts = {
  pr: 12,
  status: 'live',
  url: 'https://pr-12-acme-preview.acme.workers.dev',
  storybookUrl: 'https://pr-12.storybook-preview.acme.example',
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
    storybookUrl: null,
  });
  expect(section).not.toContain('Sign in');
  expect(previewUrlInBody(section)).toBeNull();
});

test('the link is on the first line of the section, before anything folded away', () => {
  const lines = renderPreviewSection(facts).split('\n');
  expect(lines.slice(0, 4)).toEqual([
    PREVIEW_SECTION_START,
    '## Preview',
    '',
    `🟢 live · **[pr-12-acme-preview.acme.workers.dev](${facts.url ?? ''})** · [Storybook](${facts.storybookUrl ?? ''})`,
  ]);
  const failed = renderPreviewSection({
    ...facts,
    status: 'failed',
    detail: 'boom',
  });
  // A failure's reason is said outright, not folded away.
  expect(failed.indexOf('> boom')).toBeLessThan(failed.indexOf('<details>'));
});

test('the section at the top is replaced in place and the text after it survives', () => {
  assertProperty(
    'preview section update preserves authored text',
    fc.property(authored, (after) => {
      const first = renderPreviewSection(facts);
      const second = renderPreviewSection({ ...facts, status: 'deploying' });
      const updated = upsertPreviewSection(`${first}${after}`, second);
      expect(updated).toBe(`${second}${after}`);
      expect(upsertPreviewSection(updated, second)).toBe(updated);
    })
  );
});

test('a section found anywhere else moves to the very top, around the same text', () => {
  assertProperty(
    'preview section moves to the top',
    fc.property(authored, authored, (before, after) => {
      fc.pre(before.trim() !== '');
      const section = renderPreviewSection(facts);
      const updated = upsertPreviewSection(
        `${before}${section}${after}`,
        section
      );
      const text = `${before.replace(/\s+$/, '')}${after}`.replace(/^\s+/, '');
      expect(updated).toBe(`${section}\n\n${text}`);
      expect(upsertPreviewSection(updated, section)).toBe(updated);
    })
  );
});

test('a description without the section gains it above the author’s text', () => {
  assertProperty(
    'preview section goes above authored text',
    fc.property(authored, (body) => {
      const section = renderPreviewSection(facts);
      const updated = upsertPreviewSection(body, section);
      expect(updated.startsWith(section)).toBe(true);
      expect(updated.endsWith(body.trim())).toBe(true);
      expect(previewUrlInBody(updated)).toBe(facts.url);
      expect(upsertPreviewSection(updated, section)).toBe(updated);
    })
  );
});

test('the section names the Storybook beside the Preview, each read back as its own', () => {
  const section = renderPreviewSection(facts);
  expect(previewUrlInBody(section)).toBe(facts.url);
  expect(storybookUrlInBody(section)).toBe(facts.storybookUrl);
  const without = renderPreviewSection({ ...facts, storybookUrl: null });
  expect(without).not.toContain('Storybook');
  expect(storybookUrlInBody(without)).toBeNull();
  expect(previewUrlInBody(without)).toBe(facts.url);
});
