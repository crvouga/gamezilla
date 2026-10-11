import { expect, test } from 'bun:test';
import { ManagedSession } from '@apps/synthetic-population-worker/managed-session';
import { SignInLinkMailbox } from '@apps/synthetic-population-worker/sign-in-link-mailbox';
import { redactDiagnostic } from '@libs/synthetic-population-shared/inspection';
import { ControlledRealm, settleWorker, workerFixture } from './worker-fixture';

const LINK =
  'https://app.example.test/sso-callback?email_link=cedar-one-time-token';

function managed(f: ReturnType<typeof workerFixture>, thread: ControlledRealm) {
  const session = new ManagedSession(f.assignment, 'v1', {
    ...f,
    thread,
    onClose: () => undefined,
  });
  session.start('http://localhost');
  return session;
}

test('the lease holder takes the link from the internal inbox and hands it to its realm once', async () => {
  const f = workerFixture();
  const thread = new ControlledRealm();
  const session = managed(f, thread);
  f.mail(LINK);
  thread.emit({ type: 'sign-in-link-requested' });
  await settleWorker();
  thread.emit({ type: 'sign-in-link-requested' });
  await settleWorker();
  expect(f.calls).toEqual(['take-sign-in-link', 'take-sign-in-link']);
  expect(thread.messages.slice(1)).toEqual([
    { type: 'sign-in-link', link: LINK },
    { type: 'sign-in-link', link: null },
  ]);
  session.abort();
});

test('a lease that no longer owns the user reads no mail', async () => {
  const f = workerFixture();
  const thread = new ControlledRealm();
  const session = managed(f, thread);
  f.mail(LINK);
  f.refuseInbox();
  thread.emit({ type: 'sign-in-link-requested' });
  await settleWorker();
  expect(thread.messages.slice(1)).toEqual([
    { type: 'sign-in-link', link: null },
  ]);
  session.abort();
});

test('a realm waits for its link, and every value the link carried is redacted afterwards', async () => {
  const mailbox = new SignInLinkMailbox();
  let asked = 0;
  const waiting = mailbox.take(() => {
    asked += 1;
  });
  expect(asked).toBe(1);
  expect(mailbox.secrets()).toEqual([]);
  mailbox.deliver(LINK);
  expect(await waiting).toBe(LINK);
  const diagnostic = redactDiagnostic(
    `input ${LINK} was refused: cedar-one-time-token is spent`,
    mailbox.secrets()
  );
  expect(diagnostic).not.toContain('cedar-one-time-token');
  expect(diagnostic).not.toContain('sso-callback');
});

test('a closing realm stops waiting for mail', async () => {
  const mailbox = new SignInLinkMailbox();
  const waiting = mailbox.take(() => undefined);
  mailbox.deliver(null);
  expect(await waiting).toBeNull();
  expect(mailbox.secrets()).toEqual([]);
});
