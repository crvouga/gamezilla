import {
  getDefaultOptionsFromSchema,
  getFieldsByTab,
  type SchemaField,
} from '@gamezilla/client/profile/dicebear-schema';
import {
  isStyleKey,
  type StyleKey,
} from '@gamezilla/client/profile/dicebear-styles';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  configsEqual,
  resolveAvatarConfig,
  serializeAvatarConfig,
} from '@gamezilla/domain/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { usePatchDb } from '@gamezilla/patch-db/react';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProfile } from '../use-profile';

function usePersistedConfig() {
  const { deviceId, profileId, entity } = useProfile();
  const persisted = useMemo(
    () =>
      resolveAvatarConfig(
        entity?.attributes as Record<string, unknown> | undefined,
        deviceId,
        ProfileAttr.avatarConfig
      ),
    [entity?.attributes, deviceId]
  );
  return { deviceId, profileId, persisted };
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
  deviceId: string;
  profileId: string | null;
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  initialized: boolean;
  saving: boolean;
  showDiscard: boolean;
  setShowDiscard: (v: boolean) => void;
  surface: string | null;
  setSurface: (k: string | null) => void;
  dirty: boolean;
  styleKey: StyleKey;
  byTab: ReturnType<typeof getFieldsByTab>;
  featureEnums: Extract<SchemaField, { kind: 'enum' }>[];
  previewConfig: AvatarConfig;
  updateOptions: (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => void;
  onBack: () => void;
  confirmDiscard: () => void;
  save: () => Promise<void>;
  resetStyleDefaults: () => void;
  shuffleSeed: () => void;
  copySeed: () => Promise<void>;
  closeSurface: () => void;
};

function useDerivedFields(args: {
  draft: AvatarConfig;
  deviceId: string;
  styleKey: StyleKey;
}) {
  const { draft, deviceId, styleKey } = args;
  const byTab = useMemo(() => getFieldsByTab(styleKey), [styleKey]);
  const featureEnums = useMemo(
    () =>
      byTab.features.filter(
        (f): f is Extract<SchemaField, { kind: 'enum' }> => f.kind === 'enum'
      ),
    [byTab.features]
  );
  const previewConfig = useMemo(
    () => ({
      ...draft,
      seed: draft.seed.trim() || deviceId,
    }),
    [draft, deviceId]
  );
  return { byTab, featureEnums, previewConfig };
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
  styleKey: StyleKey;
}) {
  const { setDraft, styleKey } = args;
  const updateOptions = useCallback(
    (fn: (o: Record<string, unknown>) => Record<string, unknown>) => {
      setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
    },
    [setDraft]
  );
  const resetStyleDefaults = useCallback(() => {
    const defaults = getDefaultOptionsFromSchema(styleKey);
    setDraft((d) => ({ ...d, options: { ...defaults } }));
  }, [styleKey, setDraft]);
  const shuffleSeed = useCallback(() => {
    setDraft((d) => ({ ...d, seed: globalThis.crypto.randomUUID() }));
  }, [setDraft]);
  return { updateOptions, resetStyleDefaults, shuffleSeed };
}

function useSaveAction(args: {
  draft: AvatarConfig;
  profileId: string | null;
  setSaving: (v: boolean) => void;
}) {
  const { draft, profileId, setSaving } = args;
  const router = useRouter();
  const db = usePatchDb();
  return useCallback(async () => {
    if (profileId === null) return;
    setSaving(true);
    try {
      await db.write([
        {
          entityId: profileId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.avatarConfig]: serializeAvatarConfig(draft),
          },
        },
      ]);
      router.back();
    } finally {
      setSaving(false);
    }
  }, [db, draft, profileId, router, setSaving]);
}

function useEditorActions(args: {
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  dirty: boolean;
  styleKey: StyleKey;
  deviceId: string;
  profileId: string | null;
  setShowDiscard: (v: boolean) => void;
  setSaving: (v: boolean) => void;
}) {
  const { draft, setDraft, dirty, styleKey, deviceId, profileId } = args;
  const { setShowDiscard, setSaving } = args;

  const { onBack, confirmDiscard } = useDiscardActions({
    dirty,
    setShowDiscard,
  });
  const { updateOptions, resetStyleDefaults, shuffleSeed } = useDraftMutators({
    setDraft,
    styleKey,
  });
  const save = useSaveAction({ draft, profileId, setSaving });
  const copySeed = useCallback(async () => {
    const s = draft.seed.trim() || deviceId;
    await Clipboard.setStringAsync(s);
  }, [draft.seed, deviceId]);

  return {
    updateOptions,
    onBack,
    confirmDiscard,
    save,
    resetStyleDefaults,
    shuffleSeed,
    copySeed,
  };
}

export function useAvatarEditor(): UseAvatarEditor {
  const { deviceId, profileId, persisted } = usePersistedConfig();
  const { draft, setDraft, initialized } = useDraftSync({
    persisted,
  });

  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [surface, setSurface] = useState<string | null>(null);

  const dirty = initialized && !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'lorelei';

  const { byTab, featureEnums, previewConfig } = useDerivedFields({
    draft,
    deviceId,
    styleKey,
  });

  const actions = useEditorActions({
    draft,
    setDraft,
    dirty,
    styleKey,
    deviceId,
    profileId,
    setShowDiscard,
    setSaving,
  });

  const closeSurface = useCallback(() => setSurface(null), []);

  return {
    deviceId,
    profileId,
    draft,
    setDraft,
    initialized,
    saving,
    showDiscard,
    setShowDiscard,
    surface,
    setSurface,
    dirty,
    styleKey,
    byTab,
    featureEnums,
    previewConfig,
    closeSurface,
    ...actions,
  };
}
