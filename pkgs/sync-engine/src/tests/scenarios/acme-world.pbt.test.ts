import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { runAcmeSeed } from '../apps/acme';
import { acmeDstApp } from '../apps/acme/dst-app';
import { replayActionsOnWorld } from '../dst/commands';
import { openPbtWorld } from '../dst/world-config';
import {
  runShrunkWorldProperty,
  worldPropertyInputs,
} from '../dst/world-runner';

describe('acme world PBT / DST', () => {
  test(
    'fc.commands sequences replay on SimWorld and converge',
    async () => {
      await assertDstProperty(
        'acme world converges',
        fc.asyncProperty(
          worldPropertyInputs(acmeDstApp, 14),
          async ([seed, knobs, cmds]) => {
            await runShrunkWorldProperty({
              app: acmeDstApp,
              seed,
              knobs,
              cmds,
            });
          }
        )
      );
    },
    { timeout: 120_000 }
  );

  test('serverCrash then pending setNote drains after client crash', async () => {
    const opened = await openPbtWorld({
      app: acmeDstApp,
      seed: 420184,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    try {
      await replayActionsOnWorld(acmeDstApp, opened.world, [
        { kind: 'serverCrash' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: 'pbt', title: '' },
        },
        { kind: 'crash', clientId: 'c0' },
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test('serverCrash then restartWithSchema waits for HTTP again', async () => {
    const opened = await openPbtWorld({
      app: acmeDstApp,
      seed: 1,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
        clientCount: 2,
      },
    });
    try {
      await replayActionsOnWorld(acmeDstApp, opened.world, [
        { kind: 'serverCrash' },
        {
          kind: 'restartWithSchema',
          clientId: 'c0',
          variant: 'baseline',
        },
        { kind: 'publishFault', count: 1 },
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test('protocolCut then pending setFolder drains after settle', async () => {
    const opened = await openPbtWorld({
      app: acmeDstApp,
      seed: 410988,
      knobs: {
        rowImageFanout: false,
        liveResendOnReconnect: true,
        bufferOutboundLive: true,
        clientCount: 2,
      },
    });
    try {
      await replayActionsOnWorld(acmeDstApp, opened.world, [
        { kind: 'protocolCut', clientId: 'c0' },
        {
          kind: 'domain',
          clientId: 'c0',
          mutation: 'setFolder',
          args: { id: 'f0', title: '' },
        },
        { kind: 'foreground', clientId: 'c0' },
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test('auth revoked then serverRestart skips closed-db seq checks', async () => {
    const opened = await openPbtWorld({
      app: acmeDstApp,
      seed: 546326,
      knobs: {
        rowImageFanout: true,
        liveResendOnReconnect: true,
        bufferOutboundLive: false,
        clientCount: 3,
      },
    });
    try {
      await replayActionsOnWorld(acmeDstApp, opened.world, [
        { kind: 'auth', clientId: 'c0', status: 'revoked' },
        { kind: 'serverRestart' },
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test(
    'runSeed is deterministic for a generated seed',
    async () => {
      await assertDstProperty(
        'runSeed determinism',
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
            throw new Error(`runSeed failed: ${a.error}`);
          }
          if (!b.ok) {
            throw new Error(`runSeed failed: ${b.error}`);
          }
          if (a.ok !== b.ok || a.steps !== b.steps) {
            throw new Error('runSeed not deterministic');
          }
          if (a.ok && b.ok && a.seed !== b.seed) {
            throw new Error('runSeed seed mismatch');
          }
        }),
        { numRuns: 5 }
      );
    },
    { timeout: 120_000 }
  );
});
