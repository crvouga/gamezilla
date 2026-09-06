import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import { useRouter } from '@pkgs/ui';
import type { Random } from '@pkgs/uuid';
import { useRandom } from '@pkgs/uuid/solid';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal } from 'solid-js';
import type { AvatarConfig } from '../../../shared/profile/avatar-config';
import {
  AvatarSeedGenerator,
  configsEqual,
  createDefaultAvatarConfig,
  parseAvatarConfig,
  resolveAvatarSeed,
  serializeAvatarConfig,
} from '../../../shared/profile/avatar-config';
import { patchAvatarMutation } from '../shared/patch-avatar-mutation';
import { getFieldsByTab, type SchemaField } from './dicebear-schema';
import { isStyleKey, type StyleKey } from './dicebear-styles';
import { useMyProfileId } from './use-my-profile-id';
import { useProfileRow } from './use-profile-row';

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

function useDraftSync(args: {
  persisted: Accessor<AvatarConfig>;
  ready: Accessor<boolean>;
}) {
  const [draft, setDraft] = createSignal<AvatarConfig>(args.persisted());
  const bootstrappedRef = { current: false };
  const lastPersistedRef = { current: null as AvatarConfig | null };

  createEffect(() => {
    const persisted = args.persisted();
    if (!args.ready()) return;
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
  });

  return { draft, setDraft };
}

export type UseAvatarEditor = {
  seedFallback: string;
  profileId: string | null;
  draft: AvatarConfig;
  setDraft: (
    next: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)
  ) => void;
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
  draft: Accessor<AvatarConfig>;
  seedFallback: Accessor<string>;
  styleKey: Accessor<StyleKey>;
}) {
  const byTab = createMemo(() => getFieldsByTab(args.styleKey()));
  const featureEnums = createMemo(() =>
    byTab().features.filter(
      (f): f is Extract<SchemaField, { kind: 'enum' }> => f.kind === 'enum'
    )
  );
  const colorFields = createMemo(() =>
    byTab().colors.filter(
      (f): f is Extract<SchemaField, { kind: 'color' }> =>
        f.kind === 'color' && f.key === 'backgroundColor'
    )
  );
  const effectiveSeed = createMemo(() =>
    resolveAvatarSeed(args.draft(), args.seedFallback())
  );
  const previewConfig = createMemo(() => ({
    ...args.draft(),
    seed: effectiveSeed(),
  }));
  return { byTab, featureEnums, colorFields, effectiveSeed, previewConfig };
}

function useDiscardActions(args: {
  dirty: Accessor<boolean>;
  setShowDiscard: (v: boolean) => void;
}) {
  const router = useRouter();
  const onBack = () => {
    if (args.dirty()) {
      args.setShowDiscard(true);
      return;
    }
    router.back();
  };
  const confirmDiscard = () => {
    args.setShowDiscard(false);
    router.back();
  };
  return { onBack, confirmDiscard };
}

function useDraftMutators(args: {
  setDraft: (
    next: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)
  ) => void;
  effectiveSeed: Accessor<string>;
  random: Random;
}) {
  const updateOptions = (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => {
    args.setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
  };
  const shuffleSeed = () => {
    args.setDraft((d) => ({
      ...d,
      seed: new AvatarSeedGenerator(args.random).generate(),
    }));
  };
  const setSeed = (seed: string) => {
    args.setDraft((d) => ({ ...d, seed }));
  };
  const copySeed = async () => {
    await navigator.clipboard.writeText(args.effectiveSeed());
  };
  return { updateOptions, shuffleSeed, setSeed, copySeed };
}

function useSaveAction(args: {
  draft: Accessor<AvatarConfig>;
  profileId: Accessor<string | null>;
}) {
  const mutationClient = useMutationClient();
  return async () => {
    const profileId = args.profileId();
    if (profileId === null) return;
    const result = await mutationClient.mutate(patchAvatarMutation, {
      avatarConfig: serializeAvatarConfig(args.draft()),
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}

export function useAvatarEditor(): UseAvatarEditor {
  const { seedFallback, profileId, persisted, ready } = usePersistedConfig();
  const { draft, setDraft } = useDraftSync({ persisted, ready });

  const [showDiscard, setShowDiscard] = createSignal(false);

  const dirty = createMemo(
    () => ready() && !configsEqual(draft(), persisted())
  );
  const styleKey = createMemo<StyleKey>(() => {
    const style = draft().style;
    return isStyleKey(style) ? style : 'funEmoji';
  });

  const { byTab, featureEnums, colorFields, effectiveSeed, previewConfig } =
    useDerivedFields({
      draft,
      seedFallback,
      styleKey,
    });

  const random = useRandom();

  const { onBack, confirmDiscard } = useDiscardActions({
    dirty,
    setShowDiscard,
  });
  const { updateOptions, shuffleSeed, setSeed, copySeed } = useDraftMutators({
    setDraft,
    effectiveSeed,
    random,
  });
  const save = useSaveAction({ draft, profileId });

  return {
    get seedFallback() {
      return seedFallback();
    },
    get profileId() {
      return profileId();
    },
    get draft() {
      return draft();
    },
    setDraft,
    get ready() {
      return ready();
    },
    get effectiveSeed() {
      return effectiveSeed();
    },
    get showDiscard() {
      return showDiscard();
    },
    setShowDiscard,
    get dirty() {
      return dirty();
    },
    get styleKey() {
      return styleKey();
    },
    get byTab() {
      return byTab();
    },
    get featureEnums() {
      return featureEnums();
    },
    get colorFields() {
      return colorFields();
    },
    get previewConfig() {
      return previewConfig();
    },
    updateOptions,
    onBack,
    confirmDiscard,
    save,
    shuffleSeed,
    setSeed,
    copySeed,
  };
}
