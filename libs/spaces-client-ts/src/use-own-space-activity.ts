import {
  type ActivityMap,
  IDLE_AFTER_MS,
} from '@libs/spaces-shared-ts/space-activity';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import type { Accessor } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';

/** A rejected room update does not undo the activity on this device. */
export function useOwnSpaceActivity(
  clientId: Accessor<string | undefined>,
  activity: Accessor<ActivityMap>,
  online: Accessor<boolean>
) {
  const [latest, setLatest] = createSignal<{ clientId: string; at: number }>();
  createEffect(() => {
    const id = clientId();
    const at = id === undefined ? undefined : activity()[id];
    setLatest((previous) => {
      if (id === undefined || at === undefined) {
        return previous?.clientId === id ? previous : undefined;
      }
      return {
        clientId: id,
        at: Math.max(at, previous?.clientId === id ? previous.at : at),
      };
    });
  });
  const idle = createTimedValue(
    (now) =>
      online() && latest() !== undefined && now - latest()!.at >= IDLE_AFTER_MS,
    (_idle, now) => {
      const at = latest()?.at;
      return online() && at !== undefined && at + IDLE_AFTER_MS > now
        ? at + IDLE_AFTER_MS
        : null;
    }
  );
  return { at: () => latest()?.at, idle };
}
