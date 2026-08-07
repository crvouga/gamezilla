import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AvatarConfig } from '../../shared/avatar-config';
import {
  configsEqual,
  createDefaultAvatarConfig,
  generateRandomAvatarSeed,
  parseAvatarConfig,
  resolveAvatarSeed,
  serializeAvatarConfig,
} from '../../shared/avatar-config';
import { patchAvatarMutation } from '../../shared/mutations/profile-mutations';
import { getFieldsByTab, type SchemaField } from '../dicebear-schema';
import { isStyleKey, type StyleKey } from '../dicebear-styles';
import { useMyProfileId } from '../use-my-profile-id';
import { useProfileRow } from '../use-profile-row';

function usePersistedConfig() {
  const profileId = useMyProfileId();
  const deviceId = useDeviceId();
  const { row, isLoading } = useProfileRow(profileId);
  const needsRow = profileId !== null && profileId.length > 0;
  const ready = !needsRow || !isLoading;
  const persisted = useMemo(() => {
    const parsed = parseAvatarConfig(row?.avatar_config ?? null);
    if (parsed !== null) {
      return parsed;
    }
    const id = profileId ?? deviceId;
    return createDefaultAvatarConfig(id ?? '');
  }, [row?.avatar_config, profileId, deviceId]);
  const seedFallback = profileId ?? deviceId ?? '';
  return { seedFallback, profileId, persisted, ready };
}

function useDraftSync(args: { persisted: AvatarConfig; ready: boolean }) {
  const { persisted, ready } = args;
  const [draft, setDraft] = useState<AvatarConfig>(persisted);
  const bootstrappedRef = useRef(false);
  const lastPersistedRef = useRef<AvatarConfig | null>(null);

  useEffect(() => {
    if (!ready) return;
    const prev = lastPersistedRef.current;
    if (!bootstrappedRef.current || prev === null) {
      setDraft(persisted);
      lastPersistedRef.current = persisted;
      bootstrappedRef.current = true;
      return;
    }
    if (!configsEqual(prev, persisted)) {
      setDraft((current) =>
        configsEqual(current, prev) ? persisted : current
      );
      lastPersistedRef.current = persisted;
    }
  }, [persisted, ready]);

  return { draft, setDraft, ready };
}

export type UseAvatarEditor = {
  seedFallback: string;
  profileId: string | null;
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  ready: boolean;
  effectiveSeed: string;
  showDiscard: boolean;
  setShowDiscard: (v: boolean) => void;
  dirty: boolean;
  styleKey: StyleKey;
  byTab: ReturnType<typeof getFieldsByTab>;
  featureEnums: Extract<SchemaField, { kind: 'enum' }>[];
  colorFields: Extract<SchemaField, { kind: 'color' }>[];
  previewConfig: AvatarConfig;
  updateOptions: (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => void;
  onBack: () => void;
  confirmDiscard: () => void;
  save: () => Promise<void>;
  shuffleSeed: () => void;
  setSeed: (seed: string) => void;
  copySeed: () => Promise<void>;
};

function useDerivedFields(args: {
  draft: AvatarConfig;
  seedFallback: string;
  styleKey: StyleKey;
}) {
  const { draft, seedFallback, styleKey } = args;
  const byTab = useMemo(() => getFieldsByTab(styleKey), [styleKey]);
  const featureEnums = useMemo(
    () =>
      byTab.features.filter(
        (f): f is Extract<SchemaField, { kind: 'enum' }> => f.kind === 'enum'
      ),
    [byTab.features]
  );
  const colorFields = useMemo(
    () =>
      byTab.colors.filter(
        (f): f is Extract<SchemaField, { kind: 'color' }> =>
          f.kind === 'color' && f.key === 'backgroundColor'
      ),
    [byTab.colors]
  );
  const effectiveSeed = resolveAvatarSeed(draft, seedFallback);
  const previewConfig = useMemo(
    () => ({
      ...draft,
      seed: effectiveSeed,
    }),
    [draft, effectiveSeed]
  );
  return { byTab, featureEnums, colorFields, effectiveSeed, previewConfig };
}

function useDiscardActions(args: {
  dirty: boolean;
  setShowDiscard: (v: boolean) => void;
}) {
  const { dirty, setShowDiscard } = args;
  const router = useRouter();
  const onBack = useCallback(() => {
    if (dirty) {
      setShowDiscard(true);
      return;
    }
    router.back();
  }, [dirty, router, setShowDiscard]);
  const confirmDiscard = useCallback(() => {
    setShowDiscard(false);
    router.back();
  }, [router, setShowDiscard]);
  return { onBack, confirmDiscard };
}

function useDraftMutators(args: {
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  effectiveSeed: string;
}) {
  const { setDraft, effectiveSeed } = args;
  const updateOptions = useCallback(
    (fn: (o: Record<string, unknown>) => Record<string, unknown>) => {
      setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
    },
    [setDraft]
  );
  const shuffleSeed = useCallback(() => {
    setDraft((d) => ({ ...d, seed: generateRandomAvatarSeed() }));
  }, [setDraft]);
  const setSeed = useCallback(
    (seed: string) => {
      setDraft((d) => ({ ...d, seed }));
    },
    [setDraft]
  );
  const copySeed = useCallback(async () => {
    await Clipboard.setStringAsync(effectiveSeed);
  }, [effectiveSeed]);
  return { updateOptions, shuffleSeed, setSeed, copySeed };
}

function useSaveAction(args: {
  draft: AvatarConfig;
  profileId: string | null;
}) {
  const { draft, profileId } = args;
  const mutationClient = useMutationClient();
  return useCallback(async () => {
    if (profileId === null) return;
    const result = await mutationClient.mutate(patchAvatarMutation, {
      avatarConfig: serializeAvatarConfig(draft),
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  }, [draft, mutationClient, profileId]);
}

function useEditorActions(args: {
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  dirty: boolean;
  profileId: string | null;
  effectiveSeed: string;
  setShowDiscard: (v: boolean) => void;
}) {
  const { draft, setDraft, dirty, profileId, effectiveSeed, setShowDiscard } =
    args;

  const { onBack, confirmDiscard } = useDiscardActions({
    dirty,
    setShowDiscard,
  });
  const { updateOptions, shuffleSeed, setSeed, copySeed } = useDraftMutators({
    setDraft,
    effectiveSeed,
  });
  const save = useSaveAction({ draft, profileId });

  return {
    updateOptions,
    onBack,
    confirmDiscard,
    save,
    shuffleSeed,
    setSeed,
    copySeed,
  };
}

export function useAvatarEditor(): UseAvatarEditor {
  const { seedFallback, profileId, persisted, ready } = usePersistedConfig();
  const { draft, setDraft } = useDraftSync({ persisted, ready });

  const [showDiscard, setShowDiscard] = useState(false);

  const dirty = ready && !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'funEmoji';

  const { byTab, featureEnums, colorFields, effectiveSeed, previewConfig } =
    useDerivedFields({
      draft,
      seedFallback,
      styleKey,
    });

  const actions = useEditorActions({
    draft,
    setDraft,
    dirty,
    profileId,
    effectiveSeed,
    setShowDiscard,
  });

  return {
    seedFallback,
    profileId,
    draft,
    setDraft,
    ready,
    effectiveSeed,
    showDiscard,
    setShowDiscard,
    dirty,
    styleKey,
    byTab,
    featureEnums,
    colorFields,
    previewConfig,
    ...actions,
  };
}
