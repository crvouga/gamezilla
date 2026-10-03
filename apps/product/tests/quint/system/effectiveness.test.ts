// @io-wall-ok — isolated throwaway mutations test the verification machinery.
import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_TIMEOUT_MS, MODEL_DIR } from './campaign-config';
import { quint } from './campaign-tools';

const FAULTS = [
  {
    name: 'duplicate acceptance',
    file: 'system-actions.qnt',
    before: 'if (fresh and allowed) productEffect(server,o)',
    after: 'if (allowed) productEffect(server,o)',
    test: 'lostAcknowledgementThenDeletionTest',
  },
  {
    name: 'stale session acceptance',
    file: 'replication.qnt',
    before: ' and r.token.get(d) == s.auth.epoch.get(r.owner.get(d))',
    after: '',
    test: 'revokedOfflineIntentTest',
  },
  {
    name: 'account-switch acceptance',
    file: 'system-actions.qnt',
    before: 'o.actor == clients.owner.get(d) and productAllowed(server,o)',
    after: 'productAllowed(server,o)',
    test: 'switchedAccountDoesNotAdoptQueueTest',
  },
  {
    name: 'stale snapshot acceptance',
    file: 'replication.qnt',
    before: ' and reply.state.revision >= r.floor.get(d)',
    after: '',
    test: 'staleSnapshotCannotRevivePushedDeletionTest',
  },
  {
    name: 'acknowledgement snapshot fence bypass',
    file: 'replication.qnt',
    before: ' and reply.snapshotEpoch == r.snapshotEpoch.get(d)',
    after: '',
    test: 'snapshotCapturedBeforeAcknowledgementIsDiscardedTest',
  },
  {
    name: 'removal of the last sign-in method',
    file: 'identity.qnt',
    before: ' and authMethods(s,p).size() > 1',
    after: '',
    test: 'removedProviderCannotRemoveLastMethodTest',
  },
  {
    name: 'automatic linking of a relay address',
    file: 'identity.qnt',
    before: 'trusted and i != 3',
    after: 'trusted',
    test: 'relayAddressWaitsForConsentTest',
  },
  {
    name: 'delivery of a closed request',
    file: 'notifications.qnt',
    before: 'if (not(pending)) s else',
    after: 'if (false) s else',
    test: 'closedRequestDeliveryCannotCreateActiveNotificationTest',
  },
  {
    name: 'quota bypass',
    file: 'product-state.qnt',
    before: 'gameUsed(s.game,o.actor,o.day) < gameLIMIT',
    after: 'true',
    test: 'guestQuotaHasARefusalBoundaryTest',
  },
] as const;

for (const fault of FAULTS) {
  test.concurrent(
    `verification rejects injected ${fault.name}`,
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'product-quint-mutant-'));
      try {
        cpSync(MODEL_DIR, dir, { recursive: true });
        const path = join(dir, fault.file);
        const source = readFileSync(path, 'utf8');
        expect(source.split(fault.before)).toHaveLength(2);
        writeFileSync(path, source.replace(fault.before, fault.after));
        const result = await quint([
          'test',
          join(dir, 'adversarial-examples.qnt'),
          '--backend',
          'typescript',
          '--seed',
          '0x67932',
          '--match',
          `^${fault.test}$`,
        ]);
        expect(result.status).not.toBe(0);
        // Rejecting a parse error or taking no tests is not fault sensitivity.
        expect(result.output).toContain('1 failed');
        expect(result.output).toMatch(
          /QNT508|QNT509|Assertion|assertion|expect condition/i
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    CLI_TIMEOUT_MS
  );
}
