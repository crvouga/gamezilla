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
import { usePatchesDb } from '@gamezilla/patch-db/react';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProfile } from '../use-profile';

function usePersistedConfig() {
  const { principalId, entity, loading: profileLoading } = useProfile();
  const persisted = useMemo(
    () =>
      resolveAvatarConfig(
        entity?.attributes as Record<string, unknown> | undefined,
        principalId,
        ProfileAttr.avatarConfig
      ),
    [entity?.attributes, principalId]
  );
  return { principalId, persisted, profileLoading };
}

function useDraftSync(args: {
  persisted: AvatarConfig;
  profileLoading: boolean;
}) {
  const { persisted, profileLoading } = args;
  const [draft, setDraft] = useState<AvatarConfig>(persisted);
  const [initialized, setInitialized] = useState(false);
  const lastPersistedRef = useRef<AvatarConfig | null>(null);

  useEffect(() => {
    if (profileLoading) return;
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
  }, [persisted, profileLoading]);

  return { draft, setDraft, initialized };
}

export type UseAvatarEditor = {
  principalId: string;
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
  principalId: string;
  styleKey: StyleKey;
}) {
  const { draft, principalId, styleKey } = args;
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
      seed: draft.seed.trim() || principalId,
    }),
    [draft, principalId]
  );
  return { byTab, featureEnums, previewConfig };
}

function useEditorActions(args: {
  draft: AvatarConfig;
  setDraft: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  dirty: boolean;
  styleKey: StyleKey;
  principalId: string;
  setShowDiscard: (v: boolean) => void;
  setSaving: (v: boolean) => void;
}) {
  const { draft, setDraft, dirty, styleKey, principalId, setShowDiscard, setSaving } = args;
  const router = useRouter();
  const db = usePatchesDb();

  const updateOptions = useCallback(
    (fn: (o: Record<string, unknown>) => Record<string, unknown>) => {
      setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
    },
    [setDraft]
  );
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
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await db.write([
        {
          entityId: principalId,
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
  }, [db, draft, principalId, router, setSaving]);
  const resetStyleDefaults = useCallback(() => {
    const defaults = getDefaultOptionsFromSchema(styleKey);
    setDraft((d) => ({ ...d, options: { ...defaults } }));
  }, [styleKey, setDraft]);
  const shuffleSeed = useCallback(() => {
    setDraft((d) => ({ ...d, seed: globalThis.crypto.randomUUID() }));
  }, [setDraft]);
  const copySeed = useCallback(async () => {
    const s = draft.seed.trim() || principalId;
    await Clipboard.setStringAsync(s);
  }, [draft.seed, principalId]);

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
  const { principalId, persisted, profileLoading } = usePersistedConfig();
  const { draft, setDraft, initialized } = useDraftSync({
    persisted,
    profileLoading,
  });

  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [surface, setSurface] = useState<string | null>(null);

  const dirty = initialized && !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'lorelei';

  const { byTab, featureEnums, previewConfig } = useDerivedFields({
    draft,
    principalId,
    styleKey,
  });

  const actions = useEditorActions({
    draft,
    setDraft,
    dirty,
    styleKey,
    principalId,
    setShowDiscard,
    setSaving,
  });

  const closeSurface = useCallback(() => setSurface(null), []);

  return {
    principalId,
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
