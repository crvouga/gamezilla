import { ColorSwatchGrid } from '@/features/profile/components/color-swatch-grid';
import { ProbabilityChipGroup } from '@/features/profile/components/probability-chip-group';
import { SectionCard } from '@/features/profile/components/section-card';
import { Stepper } from '@/features/profile/components/stepper';
import { StylePickerStrip } from '@/features/profile/components/style-picker-strip';
import { VariantSwatchStrip } from '@/features/profile/components/variant-swatch-strip';
import {
  getDefaultOptionsFromSchema,
  getFieldsByTab,
  type EditorTab,
  type SchemaField,
} from '@/features/profile/dicebear-schema';
import { isStyleKey, type StyleKey } from '@/features/profile/dicebear-styles';
import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import type { AvatarConfig } from '@gamezilla/shared/profile/avatar-config';
import {
  configsEqual,
  resolveAvatarConfig,
  serializeAvatarConfig,
} from '@gamezilla/shared/profile/avatar-config';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/shared/profile/profile-entities';
import {
  Box,
  Button,
  ConfirmationModal,
  ScrollView,
  SegmentedControl,
  Switch,
  Text,
} from '@gamezilla/shared/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';
import { useProfile } from '../use-profile';
import { getProbabilityMode, humanizeOptionKey } from './option-helpers';

const TABS: { key: EditorTab; label: string }[] = [
  { key: 'features', label: 'Features' },
  { key: 'colors', label: 'Colors' },
  { key: 'effects', label: 'Effects' },
  { key: 'background', label: 'Background' },
  { key: 'transform', label: 'Transform' },
];

function backgroundTypeMode(v: unknown): 'solid' | 'gradient' | 'both' {
  const a = Array.isArray(v) ? (v as string[]) : ['solid'];
  const hasS = a.includes('solid');
  const hasG = a.includes('gradientLinear');
  if (hasS && hasG) return 'both';
  if (hasG) return 'gradient';
  return 'solid';
}

function modeToBackgroundType(m: 'solid' | 'gradient' | 'both'): string[] {
  if (m === 'solid') return ['solid'];
  if (m === 'gradient') return ['gradientLinear'];
  return ['solid', 'gradientLinear'];
}

export function AvatarEditorScreen() {
  const router = useRouter();
  const db = usePatchesDb();
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

  const [draft, setDraft] = useState<AvatarConfig>(persisted);
  const [tab, setTab] = useState<EditorTab>('features');
  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  // Track the last-seen persisted config so we can tell a PatchDB poll (same
  // value, new object reference) apart from a real change. Without this the
  // draft gets clobbered every poll cycle and the user's in-progress edits
  // disappear.
  //
  // We also defer seeding the draft until PatchDB has finished loading —
  // otherwise we'd lock in the fallback (principal-id-seeded) config as the
  // baseline and then immediately treat the real persisted config as a
  // "remote change".
  const lastPersistedRef = useRef<AvatarConfig | null>(null);

  useEffect(() => {
    if (profileLoading) return;
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setDraft(persisted);
      lastPersistedRef.current = persisted;
      return;
    }
    if (!configsEqual(prev, persisted)) {
      // Persisted changed (e.g. another device). Only overwrite the draft if
      // the user hasn't made local edits yet.
      setDraft((current) =>
        configsEqual(current, prev) ? persisted : current
      );
      lastPersistedRef.current = persisted;
    }
  }, [persisted, profileLoading]);

  const dirty = !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'lorelei';

  const byTab = useMemo(() => getFieldsByTab(styleKey), [styleKey]);

  const previewConfig = useMemo(
    () => ({
      ...draft,
      seed: draft.seed.trim() || principalId,
    }),
    [draft, principalId]
  );

  const updateOptions = useCallback(
    (fn: (o: Record<string, unknown>) => Record<string, unknown>) => {
      setDraft((d) => ({ ...d, options: fn({ ...d.options }) }));
    },
    []
  );

  const onBack = useCallback(() => {
    if (dirty) {
      setShowDiscard(true);
      return;
    }
    router.back();
  }, [dirty, router]);

  const confirmDiscard = useCallback(() => {
    setShowDiscard(false);
    router.back();
  }, [router]);

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
  }, [db, draft, principalId, router]);

  const resetStyleDefaults = useCallback(() => {
    const defaults = getDefaultOptionsFromSchema(styleKey);
    setDraft((d) => ({
      ...d,
      options: { ...defaults },
    }));
  }, [styleKey]);

  const shuffleSeed = useCallback(() => {
    setDraft((d) => ({
      ...d,
      seed: globalThis.crypto.randomUUID(),
    }));
  }, []);

  const copySeed = useCallback(async () => {
    const s = draft.seed.trim() || principalId;
    await Clipboard.setStringAsync(s);
  }, [draft.seed, principalId]);

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Avatar"
        fallbackHref="/profile/edit"
        onBackPress={onBack}
        end={
          <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Button
              title="Reset"
              variant="outlined"
              onPress={resetStyleDefaults}
            />
            <Button
              title="Save"
              onPress={() => void save()}
              loading={saving}
              disabled={saving || !dirty}
            />
          </Box>
        }
      />
      <ConfirmationModal
        visible={showDiscard}
        title="Discard changes?"
        message="You have unsaved avatar changes."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
        onCancel={() => setShowDiscard(false)}
      />
      <ConstrainedContent>
        <ScrollView
          sx={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <ProfileDiceBearAvatar
              config={previewConfig}
              fallbackSeed={principalId}
              size={192}
              loading={profileLoading}
            />
            <Box
              sx={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 2,
                justifyContent: 'center',
              }}
            >
              <Button
                title="Shuffle seed"
                variant="outlined"
                onPress={shuffleSeed}
              />
              <Button
                title="Copy seed"
                variant="outlined"
                onPress={() => void copySeed()}
              />
            </Box>
            <Text
              variant="caption"
              sx={{ textAlign: 'center', opacity: 0.75 }}
              label="Preview updates as you edit. Save to keep changes."
            />
          </Box>

          <StylePickerStrip
            selected={styleKey}
            seed={draft.seed.trim() || principalId}
            principalId={principalId}
            onSelect={(k) => setDraft((d) => ({ ...d, style: k, options: {} }))}
          />

          <SegmentedControl
            segments={TABS.map((t) => ({ key: t.key, label: t.label }))}
            selected={tab}
            onSelect={(k) => setTab(k as EditorTab)}
          />

          <TabBody
            tab={tab}
            styleKey={styleKey}
            byTab={byTab}
            draft={draft}
            principalId={principalId}
            updateOptions={updateOptions}
          />
        </ScrollView>
      </ConstrainedContent>
    </Box>
  );
}

type TabBodyProps = {
  tab: EditorTab;
  styleKey: StyleKey;
  byTab: ReturnType<typeof getFieldsByTab>;
  draft: AvatarConfig;
  principalId: string;
  updateOptions: (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => void;
};

function TabBody({
  tab,
  styleKey,
  byTab,
  draft,
  principalId,
  updateOptions,
}: TabBodyProps) {
  const fields = byTab[tab];
  if (tab === 'background') {
    return (
      <BackgroundTab
        fields={fields}
        draft={draft}
        updateOptions={updateOptions}
      />
    );
  }
  if (tab === 'transform') {
    return (
      <TransformTab
        fields={fields}
        draft={draft}
        updateOptions={updateOptions}
      />
    );
  }
  return (
    <Box sx={{ gap: 2 }}>
      {tab === 'features'
        ? fields
            .filter(
              (f): f is Extract<SchemaField, { kind: 'enum' }> =>
                f.kind === 'enum'
            )
            .map((f) => (
              <SectionCard
                key={f.key}
                title={humanizeOptionKey(f.key)}
                defaultOpen={false}
              >
                <VariantSwatchStrip
                  field={f}
                  styleKey={styleKey}
                  draft={draft}
                  principalId={principalId}
                  onSelect={(variant) => {
                    updateOptions((o) => {
                      const next = { ...o };
                      if (variant === null) {
                        delete next[f.key];
                      } else {
                        next[f.key] = [variant];
                      }
                      return next;
                    });
                  }}
                />
              </SectionCard>
            ))
        : null}
      {tab === 'colors'
        ? fields
            .filter(
              (f): f is Extract<SchemaField, { kind: 'color' }> =>
                f.kind === 'color'
            )
            .map((f) => {
              const current = Array.isArray(draft.options[f.key])
                ? (draft.options[f.key] as string[])
                : f.default;
              const palette = [...new Set([...f.default, ...current])];
              return (
                <ColorSwatchGrid
                  key={f.key}
                  label={humanizeOptionKey(f.key)}
                  palette={palette}
                  defaultPalette={f.default}
                  value={current}
                  allowTransparent
                  onChange={(next) => {
                    updateOptions((o) => ({ ...o, [f.key]: next }));
                  }}
                />
              );
            })
        : null}
      {tab === 'effects'
        ? fields
            .filter(
              (f): f is Extract<SchemaField, { kind: 'probability' }> =>
                f.kind === 'probability'
            )
            .map((f) => (
              <ProbabilityChipGroup
                key={f.key}
                label={humanizeOptionKey(f.key)}
                mode={getProbabilityMode(draft.options[f.key])}
                onChange={(mode) => {
                  updateOptions((o) => {
                    const next = { ...o };
                    if (mode === 'random') {
                      delete next[f.key];
                    } else if (mode === 'off') {
                      next[f.key] = 0;
                    } else {
                      next[f.key] = 100;
                    }
                    return next;
                  });
                }}
              />
            ))
        : null}
    </Box>
  );
}

function BackgroundTab({
  fields,
  draft,
  updateOptions,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: TabBodyProps['updateOptions'];
}) {
  const bt = fields.find((f) => f.key === 'backgroundType');
  const bc = fields.find((f) => f.key === 'backgroundColor');
  const br = fields.find(
    (f) => f.kind === 'integerArray' && f.key === 'backgroundRotation'
  );

  const typeField = bt?.kind === 'enum' ? bt : null;
  const colorField = bc?.kind === 'color' ? bc : null;
  const rotField = br?.kind === 'integerArray' ? br : null;

  const o = draft.options;
  const mode = backgroundTypeMode(o['backgroundType']);

  const rotMinDefault = rotField?.default[0] ?? 0;
  const rotMaxDefault = rotField?.default[1] ?? 360;

  return (
    <Box sx={{ gap: 3 }}>
      {typeField ? (
        <Box sx={{ gap: 2 }}>
          <Text variant="label" label="Background type" />
          <SegmentedControl
            segments={[
              { key: 'solid', label: 'Solid' },
              { key: 'gradient', label: 'Gradient' },
              { key: 'both', label: 'Both' },
            ]}
            selected={mode}
            onSelect={(k) => {
              updateOptions((o) => ({
                ...o,
                backgroundType: modeToBackgroundType(
                  k as 'solid' | 'gradient' | 'both'
                ),
              }));
            }}
          />
        </Box>
      ) : null}
      {colorField ? (
        <ColorSwatchGrid
          label="Background colors"
          palette={[
            ...new Set([
              ...colorField.default,
              ...(Array.isArray(o['backgroundColor'])
                ? (o['backgroundColor'] as string[])
                : []),
            ]),
          ]}
          defaultPalette={colorField.default}
          value={
            Array.isArray(o['backgroundColor'])
              ? (o['backgroundColor'] as string[])
              : colorField.default
          }
          allowTransparent
          onChange={(next) => {
            updateOptions((o) => ({ ...o, backgroundColor: next }));
          }}
        />
      ) : null}
      {rotField && mode !== 'solid' ? (
        <Box sx={{ gap: 2 }}>
          <Text variant="label" label="Gradient rotation range (°)" />
          <Stepper
            label="Min rotation"
            min={rotField.itemMin}
            max={rotField.itemMax}
            value={
              Array.isArray(o['backgroundRotation'])
                ? (() => {
                    const a = o['backgroundRotation'] as number[];
                    const n = a[0];
                    return typeof n === 'number' ? n : rotMinDefault;
                  })()
                : rotMinDefault
            }
            onChange={(n) => {
              updateOptions((opts) => {
                const cur = Array.isArray(opts['backgroundRotation'])
                  ? [...(opts['backgroundRotation'] as number[])]
                  : [...rotField.default];
                cur[0] = n;
                if (cur.length < 2) cur.push(rotField.default[1] ?? 360);
                return { ...opts, backgroundRotation: cur };
              });
            }}
          />
          <Stepper
            label="Max rotation"
            min={rotField.itemMin}
            max={rotField.itemMax}
            value={
              Array.isArray(o['backgroundRotation'])
                ? (() => {
                    const a = o['backgroundRotation'] as number[];
                    const n = a[1];
                    return typeof n === 'number' ? n : rotMaxDefault;
                  })()
                : rotMaxDefault
            }
            onChange={(n) => {
              updateOptions((opts) => {
                const cur = Array.isArray(opts['backgroundRotation'])
                  ? [...(opts['backgroundRotation'] as number[])]
                  : [...rotField.default];
                if (cur.length < 2) cur.unshift(rotField.default[0] ?? 0);
                cur[1] = n;
                return { ...opts, backgroundRotation: cur };
              });
            }}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function TransformTab({
  fields,
  draft,
  updateOptions,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: TabBodyProps['updateOptions'];
}) {
  return (
    <Box sx={{ gap: 1 }}>
      {fields.map((f) => {
        if (f.kind === 'boolean') {
          const val =
            typeof draft.options[f.key] === 'boolean'
              ? (draft.options[f.key] as boolean)
              : f.default;
          return (
            <Box
              key={f.key}
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 2,
              }}
            >
              <Text variant="label" label={humanizeOptionKey(f.key)} />
              <Switch
                value={val}
                onValueChange={(v) => {
                  updateOptions((o) => ({ ...o, [f.key]: v }));
                }}
              />
            </Box>
          );
        }
        if (f.kind === 'integer') {
          const val =
            typeof draft.options[f.key] === 'number'
              ? (draft.options[f.key] as number)
              : f.default;
          return (
            <Stepper
              key={f.key}
              label={humanizeOptionKey(f.key)}
              min={f.min}
              max={f.max}
              value={val}
              onChange={(n) => {
                updateOptions((o) => ({ ...o, [f.key]: n }));
              }}
            />
          );
        }
        return null;
      })}
    </Box>
  );
}
