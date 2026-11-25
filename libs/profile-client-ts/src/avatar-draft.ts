import {
  type AvatarConfig,
  configsEqual,
} from '@libs/profile-shared-ts/avatar-config';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';

export function createAvatarDraft(args: {
  persisted: Accessor<AvatarConfig>;
  ready: Accessor<boolean>;
  write: (draft: AvatarConfig) => Promise<void>;
}) {
  const initial = untrack(args.persisted);
  const [draft, setDraft] = createSignal(initial);
  const [saved, setSaved] = createSignal(initial);
  let observed: AvatarConfig | null = null;
  createEffect(
    () => (args.ready() ? args.persisted() : null),
    (row) => {
      if (row === null || (observed !== null && configsEqual(row, observed)))
        return;
      if (observed === null || configsEqual(draft(), saved())) setDraft(row);
      observed = row;
      setSaved(row);
    }
  );
  const dirty = createMemo(
    () => args.ready() && !configsEqual(draft(), saved())
  );
  const save = async () => {
    const submitted = draft();
    await args.write(submitted);
    // The local write has committed even if its query notification is pending.
    setSaved(submitted);
  };
  return { draft, setDraft, dirty, save };
}
