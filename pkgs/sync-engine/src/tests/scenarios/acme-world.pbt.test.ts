import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { openWorld } from '../../sim/world';
import { runAcmeSeed } from '../apps/acme';
import { acmeDstApp } from '../apps/acme/dst-app';
import { worldPropertyInputs } from '../dst/commands';

describe('acme world PBT / DST', () => {
  test(
    'fc.commands sequences replay on World and converge',
    async () => {
      await assertDstProperty(
        'acme world converges',
        fc.asyncProperty(
          worldPropertyInputs(acmeDstApp, 14),
          async ([seed, knobs, cmds]) => {
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            await world.runCommands(cmds);
          }
        )
      );
    },
    { timeout: 120_000 }
  );

  test('armCrash partition leaveSpace tamper still session-syncs', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 999992,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('serverCrash hold brokerRestart clearLocalData does not hang', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 11,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: true,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('serverCrash then corruptQueuedArgs of new note still converges', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 65161,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('serverCrash then pending setNote drains after client crash', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 420184,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
      { kind: 'serverCrash' },
      {
        kind: 'domain',
        clientId: 'c0',
        mutation: 'setNote',
        args: { id: 'n0', body: 'pbt', title: '' },
      },
      { kind: 'crash', clientId: 'c0' },
    ]);
    await world.assertConverged();
  });

  test('serverCrash then restartWithSchema waits for HTTP again', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 1,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
      { kind: 'serverCrash' },
      {
        kind: 'restartWithSchema',
        clientId: 'c0',
        variant: 'baseline',
      },
      { kind: 'publishFault', count: 1 },
    ]);
    await world.assertConverged();
  });

  test('protocolCut then pending setFolder drains after settle', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 410988,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    await world.playActions([
      { kind: 'protocolCut', clientId: 'c0' },
      {
        kind: 'domain',
        clientId: 'c0',
        mutation: 'setFolder',
        args: { id: 'f0', title: '' },
      },
      { kind: 'foreground', clientId: 'c0' },
    ]);
    await world.assertConverged();
  });

  // FC_SEED=201419579 shrink: armCrashAt + protocolCut + mutate +
  // restartWithSchema must not hang waitForSessionSync on pending upload.
  test('armCrashAt protocolCut restartWithSchema still session-syncs', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 892161,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
      {
        kind: 'armCrashAt',
        clientId: 'c0',
        event: 'afterNextMutationsPostAccepted',
      },
      {
        kind: 'protocolCut',
        clientId: 'c0',
      },
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
    ]);
    await world.assertConverged();
  });

  test('auth revoked then serverRestart skips closed-db seq checks', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 546326,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: true,
        bufferOutboundLive: false,
        clientCount: 3,
      },
    });
    await world.playActions([
      { kind: 'auth', clientId: 'c0', status: 'revoked' },
      { kind: 'serverRestart' },
    ]);
    await world.assertConverged();
  });

  test('in-txn fail then auth revoke heals peer optimistic orphan', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 1037633887,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('auth revoked then setNote then restartWithSchema opens fresh db', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 956276660,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('server skew backwards then peer setNote still converges', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 6593,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test('server skew forward then silent insert still converges', async () => {
    await using world = await openWorld({
      app: acmeDstApp,
      seed: 3,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
  });

  test(
    'runAcmeSeed is deterministic for a generated seed',
    async () => {
      await assertDstProperty(
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
