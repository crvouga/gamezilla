import { describe, test } from 'bun:test';
import { explore } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { assertProperty, fc } from '@pkgs/pbt';
import {
  arbKnobs,
  createSyncActions,
  SYNC_PROPERTIES,
  syncVirtualHost,
} from '../../sim/scenario';
import { playAcmePin, runAcmeSeed } from '../apps/acme';
import { acmeApp } from '../apps/acme/app';
import { acmeSystem } from '../apps/acme/system';

describe('acme system PBT', () => {
  test(
    'fc.commands sequences replay on SyncKit and converge',
    async () => {
      await explore(acmeSystem, {
        host: syncVirtualHost(),
        properties: [...SYNC_PROPERTIES],
        actions: [...createSyncActions(acmeApp, acmeApp.pack.sessionQuery)],
        knobs: gen(arbKnobs()),
        steps: 14,
        episodes: 8,
        seed: 42,
        stopOnViolation: true,
        time: { weight: 1, minMs: 0, maxMs: 40 },
      });
    },
    { timeout: 120_000 }
  );

  test('armCrash partition leaveSpace tamper still session-syncs', async () => {
    await playAcmePin({
      seed: 999992,
      knobs: { rowImageFanout: true },
      actions: [
        {
          kind: 'armCrashAt',
          clientId: 'c1',
          event: 'afterNextMutationsPostAccepted',
        },
        { kind: 'partition', nodeId: 'c1', traffic: 'all' },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'leaveSpace',
          args: { spaceId: 's0' },
        },
        {
          kind: 'tamperLocalStorage',
          clientId: 'c1',
          tamper: 'corruptCheckpoint',
        },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: 'pbt', title: '' },
        },
      ],
    });
  });

  test('serverCrash hold brokerRestart clearLocalData does not hang', async () => {
    await playAcmePin({
      seed: 11,
      knobs: { rowImageFanout: true, liveResendOnReconnect: true },
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setFolder',
          args: { id: 'f0', title: 'cB7*B' },
        },
        { kind: 'serverCrash' },
        { kind: 'hold', nodeId: 'c0', traffic: 'all' },
        { kind: 'brokerRestart' },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setFolder',
          args: { id: 'f0', title: 'ir' },
        },
        { kind: 'serverCrash' },
        { kind: 'clearLocalData', clientId: 'c0', reason: 'pbt' },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setNote',
          args: { id: 'n0', body: '7PH*6rhc', title: '' },
        },
      ],
    });
  });

  test('serverCrash then corruptQueuedArgs of new note still converges', async () => {
    await playAcmePin({
      seed: 65161,
      knobs: { liveResendOnReconnect: true, bufferOutboundLive: true },
      actions: [
        { kind: 'serverCrash' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: '', title: '' },
        },
        {
          kind: 'tamperLocalStorage',
          clientId: 'c0',
          tamper: 'corruptQueuedArgs',
        },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n2', body: 'pbt', title: '' },
        },
      ],
    });
  });

  test('serverCrash then pending setNote drains after client crash', async () => {
    await playAcmePin({
      seed: 420184,
      knobs: { rowImageFanout: true },
      actions: [
        { kind: 'serverCrash' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: 'pbt', title: '' },
        },
        { kind: 'crash', clientId: 'c0' },
      ],
    });
  });

  test('serverCrash then restartWithSchema waits for HTTP again', async () => {
    await playAcmePin({
      seed: 1,
      actions: [
        { kind: 'serverCrash' },
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'baseline',
        },
        { kind: 'publishFault', count: 1 },
      ],
    });
  });

  test('protocolCut then pending setFolder drains after settle', async () => {
    await playAcmePin({
      seed: 410988,
      knobs: { liveResendOnReconnect: true, bufferOutboundLive: true },
      actions: [
        { kind: 'protocolCut', clientId: 'c0' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setFolder',
          args: { id: 'f0', title: '' },
        },
        { kind: 'foreground', clientId: 'c0' },
      ],
    });
  });

  // FC_SEED=201419579 shrink: armCrashAt + protocolCut + mutate +
  // restartWithSchema must not hang waitForSessionSync on pending upload.
  test('armCrashAt protocolCut restartWithSchema still session-syncs', async () => {
    await playAcmePin({
      seed: 892161,
      knobs: { liveResendOnReconnect: true },
      actions: [
        {
          kind: 'armCrashAt',
          clientId: 'c0',
          event: 'afterNextMutationsPostAccepted',
        },
        { kind: 'protocolCut', clientId: 'c0' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'createSpace',
          args: { id: 's0', title: '' },
        },
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'baseline',
        },
        {
          kind: 'tamperLocalStorage',
          clientId: 'c0',
          tamper: 'corruptCheckpoint',
        },
      ],
    });
  });

  test('auth revoked then serverRestart skips closed-db seq checks', async () => {
    await playAcmePin({
      seed: 546326,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: true,
        clientCount: 3,
      },
      actions: [
        { kind: 'auth', clientId: 'c0', status: 'revoked' },
        { kind: 'serverRestart' },
      ],
    });
  });

  test('in-txn fail then auth revoke heals peer optimistic orphan', async () => {
    await playAcmePin({
      seed: 1037633887,
      knobs: { rowImageFanout: true },
      actions: [
        {
          kind: 'armHttpFault',
          clientId: 'c1',
          fault: { kind: 'failMutationsInsideTxnAfter', after: 0 },
        },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setNote',
          args: { id: 'n0', body: 'pbt', title: '' },
        },
        { kind: 'auth', clientId: 'c1', status: 'revoked' },
        { kind: 'serverRestart' },
      ],
    });
  });

  test('auth revoked then setNote then restartWithSchema opens fresh db', async () => {
    await playAcmePin({
      seed: 956276660,
      knobs: { liveResendOnReconnect: true, bufferOutboundLive: true },
      actions: [
        { kind: 'auth', clientId: 'c0', status: 'revoked' },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setNote',
          args: { id: 'n0', body: 'pbt', title: '' },
        },
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'baseline',
        },
      ],
    });
  });

  test('server skew backwards then peer setNote still converges', async () => {
    await playAcmePin({
      seed: 6593,
      knobs: { liveResendOnReconnect: true, bufferOutboundLive: true },
      actions: [
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setNote',
          args: { id: 'n2', body: 'b49', title: '' },
        },
        { kind: 'skew', nodeId: 'server', skewMs: -60_000 },
        { kind: 'partition', nodeId: 'c1', traffic: 'live' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n2', body: 'b70', title: '' },
        },
      ],
    });
  });

  test('server skew forward then silent insert still converges', async () => {
    await playAcmePin({
      seed: 3,
      knobs: { bufferOutboundLive: true },
      actions: [
        { kind: 'skew', nodeId: 'server', skewMs: 60_000 },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setFolder',
          args: { id: 'f0', title: '' },
        },
        {
          kind: 'server',
          name: 'insertCatalogNoteSilent',
          args: { noteId: 'n0', body: '' },
        },
        { kind: 'protocolCut', clientId: 'c0' },
      ],
    });
  });

  // FC_SEED=14836507 counterexample [5230]: addPeerEngine then restart
  // donor must not close sqlite still held by the peer (settle closed-db).
  test('addPeerEngine then restart donor still session-syncs', async () => {
    await playAcmePin({
      seed: 5230,
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n6', body: 'b947', title: '' },
        },
        {
          kind: 'server',
          name: 'insertCatalogNoteSilent',
          args: { noteId: 'n4', body: 'c125' },
        },
        {
          kind: 'server',
          name: 'insertCatalogNoteSilent',
          args: { noteId: 'n1', body: 'c658' },
        },
        {
          kind: 'addPeerEngine',
          clientId: 'c2',
          shareWithClientId: 'c0',
        },
        { kind: 'restart', clientId: 'c0' },
        {
          kind: 'armStoragePressure',
          clientId: 'c1',
          pressure: 'sqliteFull',
          afterStatements: 2,
        },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'deleteNote',
          args: { id: 'n5' },
        },
        {
          kind: 'domain',
          clientId: 'c1',
          mutation: 'setFolder',
          args: { id: 'f3', title: 't70' },
        },
      ],
    });
  });

  test(
    'runAcmeSeed is deterministic for a generated seed',
    async () => {
      await assertProperty(
        'runAcmeSeed determinism',
        fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (seed) => {
          const a = await runAcmeSeed({
            seed,
            steps: 8,
            clientCount: 2,
            sampleFaults: false,
          });
          const b = await runAcmeSeed({
            seed,
            steps: 8,
            clientCount: 2,
            sampleFaults: false,
          });
          if (!a.ok) {
            throw new Error(`runAcmeSeed failed: ${a.error}`);
          }
          if (!b.ok) {
            throw new Error(`runAcmeSeed failed: ${b.error}`);
          }
          if (a.ok !== b.ok || a.steps !== b.steps) {
            throw new Error('runAcmeSeed not deterministic');
          }
          if (a.ok && b.ok && a.seed !== b.seed) {
            throw new Error('runAcmeSeed seed mismatch');
          }
        }),
        { numRuns: 5 }
      );
    },
    { timeout: 120_000 }
  );
});
