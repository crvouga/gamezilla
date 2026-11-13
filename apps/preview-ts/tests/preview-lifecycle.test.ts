import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  decideMainAction,
  decidePreviewAction,
  failingChecks,
  type PreviewTrigger,
  planSweep,
  uploadsDespiteGate,
} from '../src/preview-lifecycle';
import {
  customPreviewOrigin,
  isPreviewOriginOf,
  MAIN_PREVIEW_NAME,
  previewNameOfPr,
  previewOrigin,
  prOfPreviewName,
} from '../src/preview-name';

const sha = fc.stringMatching(/^[0-9a-f]{40}$/);
const pr = fc.integer({ min: 1, max: 100_000 });
const pullRequestTrigger = fc.record({
  kind: fc.constant('pull-request' as const),
  action: fc.constantFrom('opened', 'reopened', 'synchronize', 'closed'),
  pr,
  sha,
  fromFork: fc.boolean(),
});

test('a fork never deploys, destroys or reads credentials', () => {
  assertProperty(
    'a fork is always skipped',
    fc.property(
      pullRequestTrigger,
      fc.boolean(),
      sha,
      (trigger, open, head) => {
        const action = decidePreviewAction(
          { ...trigger, fromFork: true },
          { open, headSha: head }
        );
        expect(action.kind).toBe('skip');
      }
    )
  );
});

test('only the current head of an open pull request is ever deployed', () => {
  assertProperty(
    'only the open head deploys',
    fc.property(
      pullRequestTrigger,
      fc.boolean(),
      sha,
      (trigger, open, head) => {
        const action = decidePreviewAction(trigger, { open, headSha: head });
        if (action.kind !== 'deploy') return;
        expect(open).toBe(true);
        expect(trigger.fromFork).toBe(false);
        expect(action.sha).toBe(head);
        expect(action.sha).toBe(trigger.sha);
        expect(trigger.action).not.toBe('closed');
      }
    )
  );
});

test('a closed pull request is destroyed whichever event reaches it', () => {
  assertProperty(
    'a closed pull request is destroyed',
    fc.property(pullRequestTrigger, sha, (trigger, head) => {
      const action = decidePreviewAction(
        { ...trigger, fromFork: false },
        { open: false, headSha: head }
      );
      expect(action).toEqual({ kind: 'destroy', pr: trigger.pr });
    })
  );
});

test('an older commit queued behind a newer one is skipped', () => {
  const trigger: PreviewTrigger = {
    kind: 'pull-request',
    action: 'synchronize',
    pr: 7,
    sha: 'a'.repeat(40),
    fromFork: false,
  };
  expect(
    decidePreviewAction(trigger, { open: true, headSha: 'b'.repeat(40) }).kind
  ).toBe('skip');
  expect(
    decidePreviewAction(trigger, { open: true, headSha: 'a'.repeat(40) })
  ).toEqual({ kind: 'deploy', pr: 7, sha: 'a'.repeat(40) });
});

test('a close event for a pull request reopened since leaves the Preview alone', () => {
  expect(
    decidePreviewAction(
      {
        kind: 'pull-request',
        action: 'closed',
        pr: 7,
        sha: 'a'.repeat(40),
        fromFork: false,
      },
      { open: true, headSha: 'a'.repeat(40) }
    ).kind
  ).toBe('skip');
});

test('an unreadable pull request is never acted on; a schedule sweeps', () => {
  expect(
    decidePreviewAction(
      {
        kind: 'pull-request',
        action: 'opened',
        pr: 7,
        sha: 'a'.repeat(40),
        fromFork: false,
      },
      null
    ).kind
  ).toBe('skip');
  expect(decidePreviewAction({ kind: 'sweep' }, null)).toEqual({
    kind: 'sweep',
  });
});

test('preview names round-trip and nothing else parses as one', () => {
  assertProperty(
    'preview names round-trip',
    fc.property(pr, (number) => {
      expect(prOfPreviewName(previewNameOfPr(number))).toBe(number);
    })
  );
  for (const name of [
    'pr-0',
    'pr-01',
    'pr-',
    'PR-3',
    'pr-3x',
    'main',
    'pr-3-old',
  ])
    expect(prOfPreviewName(name)).toBeNull();
  expect(() => previewNameOfPr(0)).toThrow();
  expect(() => previewNameOfPr(1.5)).toThrow();
});

test('the preview origin is the Cloudflare preview host', () => {
  expect(
    previewOrigin({
      previewName: 'pr-12',
      workerName: 'acme-preview',
      subdomain: 'acme',
    })
  ).toBe('https://pr-12-acme-preview.acme.workers.dev');
  expect(() =>
    previewOrigin({
      previewName: 'pr-12',
      workerName: 'w'.repeat(60),
      subdomain: 'acme',
    })
  ).toThrow();
});

test('a Preview on the custom domain is named under the main branch’s host', () => {
  expect(
    customPreviewOrigin({ previewName: 'pr-12', host: 'preview.acme.app' })
  ).toBe('https://pr-12.preview.acme.app');
});

test('a push to main deploys only while it is still the head of main', () => {
  const sha = 'a'.repeat(40);
  expect(decideMainAction(sha, sha)).toEqual({ kind: 'deploy-main', sha });
  expect(decideMainAction(sha, 'b'.repeat(40)).kind).toBe('skip');
  expect(decideMainAction(sha, null).kind).toBe('skip');
});

test('a sweep removes exactly the Previews it made whose pull request is not open or went unused', () => {
  const day = 24 * 60 * 60 * 1000;
  assertProperty(
    'sweep removes exactly orphaned and expired',
    fc.property(
      fc.uniqueArray(pr, { maxLength: 20 }),
      fc.uniqueArray(pr, { maxLength: 20 }),
      fc.integer({ min: 0, max: 60 }),
      (previewed, open, ageDays) => {
        const nowMs = 1_000 * day;
        const plan = planSweep({
          previewNames: [
            ...previewed.map(previewNameOfPr),
            'main',
            'someone-elses',
          ],
          open: open.map((number) => ({
            pr: number,
            updatedAtMs: nowMs - ageDays * day,
          })),
          nowMs,
          retentionMs: 14 * day,
        });
        const removed = [...plan.orphaned, ...plan.expired];
        expect(new Set(removed).size).toBe(removed.length);
        for (const name of removed)
          expect(prOfPreviewName(name)).not.toBeNull();
        for (const number of previewed) {
          const name = previewNameOfPr(number);
          const isOpen = open.includes(number);
          expect(plan.orphaned.includes(name)).toBe(!isOpen);
          expect(plan.expired.includes(name)).toBe(isOpen && ageDays > 14);
        }
      }
    )
  );
});

test('only a host on our own account is this pull request’s Preview', () => {
  const ours = { previewName: 'pr-7', subdomain: 'acme' };
  const yes = (origin: string) => isPreviewOriginOf({ origin, ...ours });
  expect(yes('https://pr-7-app-preview.acme.workers.dev')).toBe(true);
  expect(yes('https://pr-7-other-name.acme.workers.dev')).toBe(true);
  expect(yes('https://pr-70-app-preview.acme.workers.dev')).toBe(false);
  expect(yes('https://pr-7-app-preview.evil.workers.dev')).toBe(false);
  expect(yes('https://pr-7-app.acme.workers.dev.evil.example')).toBe(false);
  expect(yes('https://pr-7-app.evil.acme.workers.dev')).toBe(false);
  expect(yes('http://pr-7-app-preview.acme.workers.dev')).toBe(false);
  expect(yes('https://pr-7-app-preview.acme.workers.dev:8443')).toBe(false);
  expect(yes('not a url')).toBe(false);
  // The custom domain is ours only when the tooling names it.
  expect(yes('https://pr-7.preview.acme.app')).toBe(false);
  const custom = (origin: string) =>
    isPreviewOriginOf({ origin, ...ours, host: 'preview.acme.app' });
  expect(custom('https://pr-7.preview.acme.app')).toBe(true);
  expect(custom('https://pr-7-app-preview.acme.workers.dev')).toBe(true);
  expect(custom('https://pr-70.preview.acme.app')).toBe(false);
  expect(custom('https://preview.acme.app')).toBe(false);
  expect(custom('https://pr-7.preview.acme.app.evil.example')).toBe(false);
  expect(custom('http://pr-7.preview.acme.app')).toBe(false);
});

test('a pull request uploads whatever was built; the main branch only what passes its gate', () => {
  assertProperty(
    'every pull request Preview is best effort',
    fc.property(pr, (number) => uploadsDespiteGate(previewNameOfPr(number)))
  );
  expect(uploadsDespiteGate(MAIN_PREVIEW_NAME)).toBe(false);
});

test('an uploaded site fails its checks when its gate or its served checks failed', () => {
  expect(failingChecks({ gate: null, served: null })).toBeNull();
  expect(
    failingChecks({ gate: 'bundle: /assets/index.js 404', served: null })
  ).toBe('before upload: bundle: /assets/index.js 404');
  expect(failingChecks({ gate: null, served: 'shell: 500' })).toBe(
    'served: shell: 500'
  );
  expect(failingChecks({ gate: 'bundle: 404', served: 'shell: 500' })).toBe(
    'before upload: bundle: 404; served: shell: 500'
  );
});
