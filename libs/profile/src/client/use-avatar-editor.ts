import {
  getFieldsByTab,
  type SchemaField,
} from './dicebear-schema';
import { isStyleKey, type StyleKey } from './dicebear-styles';
import type { AvatarConfig } from '../shared/avatar-config';
import {
  configsEqual,
  createDefaultAvatarConfig,
  parseAvatarConfig,
  serializeAvatarConfig,
} from '../shared/avatar-config';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMyProfileId } from './use-my-profile-id';
import { useProfileRow } from './use-profile-row';

function usePersistedConfig() {
  const profileId = useMyProfileId();
  const deviceId = useDeviceId();
  const row = useProfileRow(profileId);
  const persisted = useMemo(() => {
    const parsed = parseAvatarConfig(row?.avatar_config ?? null);
    if (parsed !== null) {
      return parsed;
    }
    const id = profileId ?? deviceId;
    return createDefaultAvatarConfig(id ?? '');
  }, [row?.avatar_config, profileId, deviceId]);
  const seedFallback = profileId ?? deviceId ?? '';
  return { seedFallback, profileId, persisted };
}

function useDraftSync(args: { persisted: AvatarConfig }) {
  const { persisted } = args;
  const [draft, setDraft] = useState<AvatarConfig>(persisted);
  const [initialized, setInitialized] = useState(false);
  const lastPersistedRef = useRef<AvatarConfig | null>(null);

  useEffect(() => {
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setDraft(persisted);
      lastPersistedRef.current = persisted;
      setInitialized(true);
      return;
    }
    if (!configsEqual(prev, persisted)) {
      setDraft((current) =>
        configsEqual(current, prev) ? persisted : current
      );
      lastPersistedRef.current = persisted;
    }
  }, [persisted]);

  return { draft, setDraft, initialized };
}

export type UseAvatarEditor = {
  /** Profile `entityId` (or install id before profile id is known) for empty-seed preview. */
  seedFallback: string;
  profileId: string | null;
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  initialized: boolean;
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
  const previewConfig = useMemo(
    () => ({
      ...draft,
      seed: draft.seed.trim() || seedFallback,
    }),
    [draft, seedFallback]
  );
  return { byTab, featureEnums, colorFields, previewConfig };
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
}) {
  const { setDraft } = args;
  const updateOptions = useCallback(
    (fn: (o: Record<string, unknown>) => Record<string, unknown>) => {
      setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
    },
    [setDraft]
  );
  const shuffleSeed = useCallback(() => {
    setDraft((d) => ({ ...d, seed: globalThis.crypto.randomUUID() }));
  }, [setDraft]);
  return { updateOptions, shuffleSeed };
}

function useSaveAction(args: {
  draft: AvatarConfig;
  profileId: string | null;
}) {
  const { draft, profileId } = args;
  const engine = useSyncEngine();
  return useCallback(async () => {
    if (profileId === null) return;
    await engine.db.run(
      `UPDATE ${PROFILES_TABLE.tableName} SET ${ProfileCol.avatarConfig} = ? WHERE ${ProfileCol.id} = ?`,
      [serializeAvatarConfig(draft), profileId]
    );
  }, [engine, draft, profileId]);
}

function useEditorActions(args: {
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  dirty: boolean;
  profileId: string | null;
  setShowDiscard: (v: boolean) => void;
}) {
  const { draft, setDraft, dirty, profileId, setShowDiscard } = args;

  const { onBack, confirmDiscard } = useDiscardActions({
    dirty,
    setShowDiscard,
  });
  const { updateOptions, shuffleSeed } = useDraftMutators({ setDraft });
  const save = useSaveAction({ draft, profileId });

  return {
    updateOptions,
    onBack,
    confirmDiscard,
    save,
    shuffleSeed,
  };
}

export function useAvatarEditor(): UseAvatarEditor {
  const { seedFallback, profileId, persisted } = usePersistedConfig();
  const { draft, setDraft, initialized } = useDraftSync({
    persisted,
  });

  const [showDiscard, setShowDiscard] = useState(false);

  const dirty = initialized && !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'funEmoji';

  const { byTab, featureEnums, colorFields, previewConfig } = useDerivedFields({
    draft,
    seedFallback,
    styleKey,
  });

  const actions = useEditorActions({
    draft,
    setDraft,
    dirty,
    profileId,
    setShowDiscard,
  });

  return {
    seedFallback,
    profileId,
    draft,
    setDraft,
    initialized,
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
