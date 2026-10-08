import { useMyId } from '@libs/auth-client/use-current-user';
import { ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { ChessPuzzleResultAttr } from '@libs/chess-puzzle-shared/chess-puzzle-result';
import { useSpaceRoomSessionId } from '@libs/spaces-client/space-room-context';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import { useLogger } from '@pkgs/logger-client/solid';
import { useSecureStorageStore } from '@pkgs/secure-storage-root-client/solid';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useIsPuzzleDriver } from './use-puzzle-space-role';

function keyPart(value: string): string {
  return Array.from(value, (character) =>
    character.codePointAt(0)!.toString(16)
  ).join('-');
}

/** Device-local presentation memory; account puzzle history remains synced. */
export function usePuzzleAttemptMemory() {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const attempt = useSpaceRoomSelector(ChessPuzzleResultAttr.attempt.from);
  const status = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const canPick = useIsPuzzleDriver();
  const store = useSecureStorageStore();
  const log = useLogger('puzzle-attempt-memory');
  const key = createMemo(() =>
    myId().length === 0 || spaceId() === null
      ? null
      : `chess.puzzle.attempt.${keyPart(myId())}.${keyPart(spaceId()!)}`
  );
  const [snapshot, setSnapshot] = createSignal({
    key: null as string | null,
    value: null as string | null,
    ready: false,
    unavailable: false,
  });
  createEffect(() => {
    const current = key();
    if (current === null) return;
    let active = true;
    const refresh = () => {
      if (!active) return;
      setSnapshot({
        key: current,
        value: store.getValue(current),
        ready: store.isHydrated(current),
        unavailable: false,
      });
    };
    const unsubscribe = store.subscribe(current, refresh);
    refresh();
    onCleanup(() => {
      active = false;
      unsubscribe();
    });
    void store.hydrate(current).catch((error: unknown) => {
      if (!active) return;
      log.error('Puzzle resume memory could not be read', { error });
      setSnapshot({
        key: current,
        value: null,
        ready: true,
        unavailable: true,
      });
    });
  });
  const ready = createMemo(() => snapshot().key === key() && snapshot().ready);
  const seen = createMemo(
    () => ready() && (snapshot().unavailable || snapshot().value === attempt())
  );
  createEffect(() => {
    const current = key();
    const id = attempt();
    const playing = status() === 'solving' || status() === 'wrong';
    if (!ready() || !canPick() || !playing || current === null || id === null)
      return;
    if (snapshot().value === id) return;
    void store.write(current, id).catch((error: unknown) => {
      log.error('Puzzle resume memory could not be saved', { error });
    });
  });
  return { ready, seen };
}
