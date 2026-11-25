import { useDeviceId } from '@libs/auth-client-ts/use-device-id';
import {
  AvatarSeedGenerator,
  createDefaultAvatarConfig,
  parseAvatarConfig,
  resolveAvatarSeed,
  serializeAvatarConfig,
} from '@libs/profile-shared-ts/avatar-config';
import { patchAvatarMutation } from '@libs/profile-shared-ts/patch-avatar-mutation';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import { createAvatarDraft } from './avatar-draft';
import type { AvatarEditorScreenViewProps } from './avatar-editor-screen-view';
import { useMyProfileId } from './patch-avatar-use-my-profile-id';
import { useProfileRow } from './patch-avatar-use-profile-row';

function usePersistedConfig() {
  const profileId = useMyProfileId();
  const deviceId = useDeviceId();
  const { row, isLoading } = useProfileRow(profileId);
  const needsRow = createMemo(() => {
    const id = profileId();
    return id !== null && id.length > 0;
  });
  const ready = createMemo(() => !needsRow() || !isLoading());
  const persisted = createMemo(() => {
    const parsed = parseAvatarConfig(row()?.avatar_config ?? null);
    if (parsed !== null) {
      return parsed;
    }
    const id = profileId() ?? deviceId();
    return createDefaultAvatarConfig(id ?? '');
  });
  const seedFallback = createMemo(() => profileId() ?? deviceId() ?? '');
  return { seedFallback, profileId, persisted, ready };
}

const COPIED_HOLD_MS = 2000;

/** The copy button's confirmation, held for a moment after each copy. */
function useSeedCopy(seed: Accessor<string>) {
  const timers = useTimers();
  const [copied, setCopied] = createSignal(false);
  createEffect(
    () => copied(),
    (isCopied) => {
      if (!isCopied) return;
      const id = timers.setTimeout(() => setCopied(false), COPIED_HOLD_MS);
      return () => timers.clearTimeout(id);
    }
  );
  const copy = () => {
    void navigator.clipboard.writeText(seed()).then(() => setCopied(true));
  };
  return { copied, copy };
}

function useDiscardActions(dirty: Accessor<boolean>) {
  const router = useRouter();
  const [confirming, setConfirming] = createSignal(false);
  const onBack = () => {
    if (dirty()) {
      setConfirming(true);
      return;
    }
    router.back();
  };
  const onConfirmDiscard = () => {
    setConfirming(false);
    router.back();
  };
  return {
    confirming,
    onBack,
    onConfirmDiscard,
    onKeepEditing: () => setConfirming(false),
  };
}

/**
 * The avatar editor's state and effects as `AvatarEditorScreenView` props:
 * the draft seeded from the saved avatar, the discard guard, the seed
 * clipboard, and the patch-avatar mutation. `notice` is left to the screen.
 */
export function useAvatarEditor(): Omit<AvatarEditorScreenViewProps, 'notice'> {
  const { seedFallback, profileId, persisted, ready } = usePersistedConfig();
  const mutationClient = useMutationClient();
  const { draft, setDraft, dirty, save } = createAvatarDraft({
    persisted,
    ready,
    async write(config) {
      const result = await mutationClient.mutate(patchAvatarMutation, {
        avatarConfig: serializeAvatarConfig(config),
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
  });
  const effectiveSeed = createMemo(() =>
    resolveAvatarSeed(draft(), seedFallback())
  );
  const random = useRandom();
  const discard = useDiscardActions(dirty);
  const seedCopy = useSeedCopy(effectiveSeed);
  return {
    get status() {
      return ready() ? 'ready' : 'loading';
    },
    get draft() {
      return draft();
    },
    get seedFallback() {
      return seedFallback();
    },
    get canSave() {
      return dirty() && profileId() !== null;
    },
    get seedCopied() {
      return seedCopy.copied();
    },
    get confirmingDiscard() {
      return discard.confirming();
    },
    onDraftChange: setDraft,
    onRandomizeSeed: () =>
      setDraft((d) => ({
        ...d,
        seed: new AvatarSeedGenerator(random).generate(),
      })),
    onCopySeed: seedCopy.copy,
    onBack: discard.onBack,
    onConfirmDiscard: discard.onConfirmDiscard,
    onKeepEditing: discard.onKeepEditing,
    onSave: async () => {
      if (profileId() !== null) await save();
    },
  };
}
