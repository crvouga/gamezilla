import { letTimePass } from '@libs/harness/actions';
import { scenarioAction } from '@libs/harness/actor-ui';
import { IDLE_AFTER_MS } from '@libs/spaces-shared/space-activity';
import { closeSpaceMembers, openSpaceMembers } from './space-actions';
import { ownActivityAt } from './space-idle-reads';
import { activeSpaceVisible } from './spaces-ui-reads';

const MINUTE_MS = 60_000;

/**
 * Time passes with nothing done on `actorId`. Two minutes makes that device
 * quiet. Other devices that were not already quiet keep doing something, so
 * only this device crosses two minutes.
 */
export const stayIdle = scenarioAction({
  name: 'stayIdle',
  act: async (s, actorId: string, minutes: number) => {
    const now = s.session.ports.clock.now();
    const alreadyQuiet = new Set<string>();
    for (const other of s.actors.keys()) {
      if (other === actorId) continue;
      if (!(await activeSpaceVisible(s, other))) continue;
      const at = await ownActivityAt(s, other);
      if (at !== null && now - at >= IDLE_AFTER_MS) alreadyQuiet.add(other);
    }
    await Promise.resolve(letTimePass.act(s, minutes * MINUTE_MS));
    if (minutes < 2) return;
    for (const other of s.actors.keys()) {
      if (other === actorId || alreadyQuiet.has(other)) continue;
      if (!(await activeSpaceVisible(s, other))) continue;
      await Promise.resolve(openSpaceMembers.act(s, other));
      await Promise.resolve(closeSpaceMembers.act(s, other));
    }
  },
});
