import { refreshActorConnection } from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { readMutationFeedback } from '@libs/harness-ts/mutation-feedback-reads';
import {
  connectionDiagnostics,
  connectionMissing,
} from '@libs/harness-ts/network-notices';
import { HARNESS_PRIMARY_SERVER_ID } from '@libs/harness-ts/server-nodes';
import { endSpace } from '@libs/spaces-harness-ts/space-actions';
import { joinAcceptedOnServer } from '@libs/spaces-harness-ts/space-join-interruption';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { preferencePlace, themeShown } from './preference-recovery';
import { sharedChoiceCanBePutAside } from './shared-choice-continuity';

/** Independent faults at the device's path and at shared-choice ingress. */
export const setContinuityConnection = scenarioAction({
  name: 'setContinuityConnection',
  act: async (
    s,
    actor: string,
    point: 'device' | 'shared',
    online: boolean
  ) => {
    const other = HARNESS_PRIMARY_SERVER_ID;
    if (point === 'shared') {
      if (online) s.harness.restart(other);
      else s.harness.crash(other);
      await Promise.resolve(refreshActorConnection.act(s, actor));
      await s.session.waitForIdle();
      await settleContinuityConnection(s, actor);
      return;
    }
    if (online) {
      s.harness.net.heal(actor, other);
      s.session.network.heal(actor, other);
    } else {
      s.harness.net.partition(actor, other);
      s.session.network.partition(actor, other);
    }
    await Promise.resolve(refreshActorConnection.act(s, actor));
    await s.session.waitForIdle();
    await settleContinuityConnection(s, actor);
  },
});

/** The model's availability event ends once the actual app observes that port state. */
async function settleContinuityConnection(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const reachable = s.harness.net.isReachable(actor, HARNESS_PRIMARY_SERVER_ID);
  await pollUntil(
    s,
    async () =>
      (await connectionMissing(s, actor)) === !reachable ? true : null,
    { maxMs: 15_000, stepMs: 1, description: 'current connection notice' }
  ).catch(async (cause: unknown) => {
    throw new Error(
      `Connection notice did not settle: ${JSON.stringify(await connectionDiagnostics(s, actor))}`,
      { cause }
    );
  });
}

export const answerContinuityChoice = scenarioAction({
  name: 'answerContinuityChoice',
  act: async (
    s,
    actor: string,
    answer: 'accepted' | 'refused' | 'unheard',
    link: string
  ) => {
    if (answer === 'refused') {
      await Promise.resolve(endSpace.act(s, 'bob'));
      // The optimistic ended view is not the server's refusal precondition.
      await pollUntil(
        s,
        async () =>
          (
            await readMutationFeedback(s, 'bob', {
              name: 'endSpace',
              scope: { spaceId: link.slice('/space/'.length) },
            })
          )?.status === 'confirmed'
            ? true
            : null,
        { maxMs: 5000, stepMs: 1, description: 'confirmed space ending' }
      );
    }
    if (answer === 'unheard')
      s.harness.net.holdHttp(actor, '/api/mutations').acceptWithoutAnswer();
    else s.harness.net.releaseHttp(actor, '/api/mutations');
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () => {
        if (answer === 'unheard')
          return (await joinAcceptedOnServer(s, actor, link)) ? true : null;
        const feedback = await readMutationFeedback(s, actor, {
          name: 'joinSpace',
          scope: { spaceId: link.slice('/space/'.length) },
        });
        return feedback?.status ===
          (answer === 'accepted' ? 'confirmed' : 'rejected')
          ? true
          : null;
      },
      { maxMs: 5000, stepMs: 1, description: `shared choice ${answer}` }
    );
  },
});

/** Local place and the persisted outcome, including when its control is put aside. */
export async function readContinuityChoice(
  s: ProductHarness,
  actor: string,
  link: string
) {
  const ui = await actorUi(s, actor);
  const feedback = await readMutationFeedback(s, actor, {
    name: 'joinSpace',
    scope: { spaceId: link.slice('/space/'.length) },
  });
  const open =
    (await s.actors.get(actor)?.currentPath()) === link &&
    feedback?.status !== 'confirmed';
  return {
    place: await preferencePlace(s, actor),
    theme: await themeShown(s, actor),
    choiceOpen: open,
    choiceUnfinished: feedback?.status === 'pending',
    choiceConfirmed: feedback?.status === 'confirmed',
    connectionMissing: await ui
      .get(Handles.statusConnectionMissing)
      .isVisible(),
    canPutAside: open && (await sharedChoiceCanBePutAside(s, actor)),
  };
}
