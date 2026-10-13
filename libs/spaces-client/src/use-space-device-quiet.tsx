import { MarkQuiet } from '@libs/spaces-shared/space-quiet';
import { Handles } from '@libs/test-ids-shared/handles';
import { useTimers } from '@pkgs/clock-client/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  type Accessor,
  createContext,
  createEffect,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';

import { noteSpaceQuiet, registerSpaceQuiet } from './space-quiet-registry';
import { useSpaceRoomClientId } from './space-room-context';
import { useSpaceRoomDispatch } from './use-space-room-selector';

/** Two minutes with nothing done is idle. One minute is not. */
const QUIET_MS = 120_000;

const ClearQuietContext = createContext<Accessor<(() => void) | null>>(
  () => null
);

/** Opening presence counts as doing something, so the person is not idle. */
export function useClearSpaceQuiet(): () => void {
  const clear = useContext(ClearQuietContext);
  return () => clear()?.();
}

/**
 * Marks this device quiet after two minutes, and clears that when the person
 * does something, steps out, or the connection returns.
 */
export function SpaceQuietHost(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const clientId = useSpaceRoomClientId();
  const dispatch = useSpaceRoomDispatch();
  const timers = useTimers();
  const engine = useSyncEngine();
  const pending = {
    current: null as ReturnType<typeof timers.setTimeout> | null,
  };
  const wasOnline = { current: engine.status().online };

  const mark = (quiet: boolean): void => {
    const id = clientId();
    if (id === null || id.length === 0) return;
    noteSpaceQuiet(id, quiet);
    dispatch(MarkQuiet({ clientId: id, quiet }));
  };

  const arm = (): void => {
    if (pending.current !== null) timers.clearTimeout(pending.current);
    pending.current = timers.setTimeout(() => mark(true), QUIET_MS);
  };

  const poke = (): void => {
    mark(false);
    arm();
  };

  createEffect(() => {
    const id = clientId();
    if (id === null || id.length === 0) return;
    arm();
    onCleanup(
      registerSpaceQuiet(id, (quiet) => {
        if (quiet) mark(true);
        else poke();
      })
    );
  });

  createEffect(() => {
    const online = engine.status().online;
    if (online && !wasOnline.current) poke();
    wasOnline.current = online;
  });

  onCleanup(() => {
    if (pending.current !== null) timers.clearTimeout(pending.current);
    mark(false);
  });

  return (
    <ClearQuietContext.Provider value={() => poke}>
      <div class="box flex-1 min-h-0" onPointerDown={() => poke()}>
        <span
          data-testid={Handles.spaceQuietClient}
          class="hidden"
          aria-hidden="true"
        >
          {clientId() ?? ''}
        </span>
        {props.children}
      </div>
    </ClearQuietContext.Provider>
  );
}
