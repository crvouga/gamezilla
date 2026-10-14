import { useMyId } from '@libs/auth-client/use-current-user';
import type { SelectedGameId } from '@libs/spaces-shared/games';
import { SelectGame } from '@libs/spaces-shared/games';
import { useLogger } from '@pkgs/logger-client/solid';
import { useSecureStorageStore } from '@pkgs/secure-storage-root-client/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { useSpaceRoomSessionId } from './space-room-context';
import { useSpaceRoomDispatch } from './use-space-room-selector';

type LocalBrowse =
  | { readonly kind: 'room' }
  | { readonly kind: 'list' }
  | { readonly kind: 'game'; readonly game: string };

function readBrowse(value: string | null): LocalBrowse {
  if (value === null) return { kind: 'room' };
  if (value === '') return { kind: 'list' };
  return { kind: 'game', game: value };
}

/** Browsing while offline survives reopening this person's space. */
export function useOfflineGameBrowse(
  selectedGame: () => SelectedGameId | null
) {
  const dispatch = useSpaceRoomDispatch();
  const engine = useSyncEngine();
  const store = useSecureStorageStore();
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const log = useLogger('offline-game-browse');
  const key = createMemo(
    () => `space.game-browse.${myId()}.${spaceId() ?? ''}`
  );
  const [local, setLocal] = createSignal<LocalBrowse>({ kind: 'room' });
  const [ready, setReady] = createSignal(false);
  createEffect(() => {
    const current = key();
    const refresh = () => {
      setReady(store.isHydrated(current));
      setLocal(readBrowse(store.getValue(current)));
    };
    const unsubscribe = store.subscribe(current, refresh);
    refresh();
    onCleanup(unsubscribe);
    void store.hydrate(current).catch((error: unknown) => {
      log.error('Offline game choice could not be read', { error });
      if (key() === current) setReady(true);
    });
  });
  const choose = (choice: LocalBrowse): void => {
    setLocal(choice);
    const value =
      choice.kind === 'game' ? choice.game : choice.kind === 'list' ? '' : null;
    void store.write(key(), value).catch((error: unknown) => {
      log.error('Offline game choice could not be saved', { error });
    });
  };
  let promoting = false;
  createEffect(() => {
    const choice = local();
    const online = engine.status().online;
    const selected = selectedGame();
    if (!ready() || !online || choice.kind === 'room') {
      promoting = false;
      return;
    }
    const game = choice.kind === 'list' ? null : choice.game;
    if (selected === game) {
      choose({ kind: 'room' });
      return;
    }
    if (promoting) return;
    promoting = true;
    dispatch(SelectGame({ game }));
  });
  return {
    shownGame: () => {
      const choice = local();
      if (choice.kind === 'list') return null;
      if (choice.kind === 'game') return choice.game;
      return selectedGame();
    },
    chooseGame: (game: SelectedGameId) => {
      if (!engine.status().online) {
        choose(game === null ? { kind: 'list' } : { kind: 'game', game });
        return;
      }
      choose({ kind: 'room' });
      dispatch(SelectGame({ game }));
    },
    showList: () => {
      if (!engine.status().online) {
        choose({ kind: 'list' });
        return;
      }
      choose({ kind: 'room' });
      dispatch(SelectGame({ game: null }));
    },
  };
}
