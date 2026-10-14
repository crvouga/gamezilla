import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { IDLE_AFTER_MS } from '@libs/spaces-shared/space-activity';
import { closeSpaceMembers, openSpaceMembers } from './space-actions';
import { ownActivityAt } from './space-idle-reads';
import { activeSpaceVisible } from './spaces-ui-reads';

const MINUTE_MS = 60_000;

type Activity = { readonly actor: string; readonly at: number };

async function otherActivity(
  s: ProductHarness,
  actorId: string,
  end: number
): Promise<Activity[]> {
  const now = s.session.ports.clock.now();
  const activities: Activity[] = [];
  for (const other of s.actors.keys()) {
    if (other === actorId || !(await activeSpaceVisible(s, other))) continue;
    const at = await ownActivityAt(s, other);
    if (at === null || now - at >= IDLE_AFTER_MS) continue;
    // A device's partial quiet minute stays partial when another device waits.
    activities.push({ actor: other, at: Math.max(now, end - (now - at)) });
  }
  return activities.sort((a, b) => a.at - b.at);
}

/** This device waits; other devices keep their existing amount of quiet time. */
export const stayIdle = scenarioAction({
  name: 'stayIdle',
  act: async (s, actorId: string, minutes: number) => {
    const end = s.session.ports.clock.now() + minutes * MINUTE_MS;
    const activities = await otherActivity(s, actorId, end);
    for (const activity of activities) {
      const remaining = activity.at - s.session.ports.clock.now();
      if (remaining > 0) await s.session.advanceTime(remaining);
      await Promise.resolve(openSpaceMembers.act(s, activity.actor));
      await Promise.resolve(closeSpaceMembers.act(s, activity.actor));
    }
    const remaining = end - s.session.ports.clock.now();
    if (remaining > 0) await s.session.advanceTime(remaining);
  },
});
