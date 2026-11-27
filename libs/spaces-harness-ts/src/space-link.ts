import { actorUi, ensureActor, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { describeSpaceLinkOpening } from './space-link-diagnosis';
import { SPACE_LINK_RECOVERY, SPACE_WAIT_MS } from './space-ui';

export async function openSpaceLinkOnDevice(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<void> {
  const actor = s.actors.get(actorId);
  if (actor === undefined) {
    await ensureActor(s, actorId, link);
    return;
  }
  await actor.openLink(link);
  // A parked actor has no visible screen until its driver brings it forward.
  await actor.ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
}

type JoinGoal = 'observe' | 'enter';
type JoinPhase = 'opening the link' | 'after pressing Join';

async function waitForLink(
  s: ProductHarness,
  actor: string,
  options: { phase: JoinPhase; goal: JoinGoal; link: string }
): Promise<string> {
  const { phase, goal, link } = options;
  const ui = await actorUi(s, actor);
  const opening = phase === 'opening the link';
  // A connection notice can coexist with an offered Join. After the tap,
  // the same button stays mounted while the device waits for confirmation.
  const next = opening
    ? [Handles.spaceActive, Handles.spaceJoin]
    : [Handles.spaceActive];
  const settled = new Set<string>(
    goal === 'enter' ? next : [...next, ...SPACE_LINK_RECOVERY]
  );
  const handles = [
    ...new Set([
      ...next,
      ...SPACE_LINK_RECOVERY,
      Handles.spaceJoinNotConfirmed,
      Handles.spaceJoin,
      Handles.spaceJoinOpening,
      Handles.spaceJoinCheckingHost,
    ]),
  ];
  let lastSeen = 'no invitation outcome';
  return pollUntil(
    s,
    async () => {
      for (const handle of handles) {
        if (!(await ui.get(handle).isVisible())) continue;
        lastSeen = handle;
        if (settled.has(handle)) return handle;
        break;
      }
      return null;
    },
    {
      maxMs: SPACE_WAIT_MS,
      actor,
      description: async () => {
        const details =
          opening && lastSeen === Handles.spaceJoinOpening
            ? await describeSpaceLinkOpening(s, actor, link)
            : '';
        return `${actor} ${phase} (last saw ${lastSeen}${details})`;
      },
    }
  );
}

/** Open once and tap Join once if offered. An entry prerequisite waits for
 * the joined space. An attempt can also settle on the invitation's refusal. */
export async function joinSpaceFromLink(
  s: ProductHarness,
  actor: string,
  link: string,
  goal: JoinGoal
): Promise<{ opened: string; afterJoin?: string }> {
  await openSpaceLinkOnDevice(s, actor, link);
  // regression: space-link-join-skipped-mid-opening
  const opened = await waitForLink(s, actor, {
    phase: 'opening the link',
    goal,
    link,
  });
  if (opened !== Handles.spaceJoin) return { opened };
  const ui = await actorUi(s, actor);
  await ui.get(Handles.spaceJoin).tap({ timeoutMs: SPACE_WAIT_MS });
  const afterJoin = await waitForLink(s, actor, {
    phase: 'after pressing Join',
    goal,
    link,
  });
  return { opened, afterJoin };
}
