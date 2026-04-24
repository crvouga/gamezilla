import { StylePickerStrip } from '@gamezilla/client/features/profile/components/style-picker-strip';
import { VariantSwatchStrip } from '@gamezilla/client/features/profile/components/variant-swatch-strip';
import {
  getDefaultOptionsFromSchema,
  getFieldsByTab,
  type SchemaField,
} from '@gamezilla/client/features/profile/dicebear-schema';
import {
  isStyleKey,
  styleLabel,
  type StyleKey,
} from '@gamezilla/client/features/profile/dicebear-styles';
import { ProfileDiceBearAvatar } from '@gamezilla/client/features/profile/profile-dicebear-avatar';
import { usePatchesDb } from '@gamezilla/patch-db/react';
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
import {
  Box,
  Button,
  ChipGroup,
  ConfirmationModal,
  MultiSelectSwatchGrid,
  NumberStepper,
  Pressable,
  ResponsiveSurface,
  ScreenBase,
  SegmentedControl,
  Switch,
  Text,
} from '@gamezilla/lib/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProfile } from '../use-profile';
import {
  getEnumSelectionMode,
  getProbabilityMode,
  humanizeOptionKey,
} from './option-helpers';

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

function TriggerRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        py: 3,
        borderBottomWidth: 1,
        borderColor: 'border',
        gap: 2,
      }}
    >
      <Text variant="label" label={label} style={{ flex: 1 }} />
      <Text
        variant="body"
        numberOfLines={1}
        style={{ flex: 1.5, textAlign: 'right', opacity: 0.85 }}
        label={value}
      />
      <Text variant="caption" label="›" />
    </Pressable>
  );
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
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [surface, setSurface] = useState<string | null>(null);

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

  const dirty = initialized && !configsEqual(draft, persisted);
  const styleKey: StyleKey = isStyleKey(draft.style) ? draft.style : 'lorelei';

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

  const closeSurface = useCallback(() => setSurface(null), []);

  return (
    <>
      <ConfirmationModal
        visible={showDiscard}
        title="Discard changes?"
        message="You have unsaved avatar changes."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
        onCancel={() => setShowDiscard(false)}
      />
      <ScreenBase
        breadcrumbs={[{ name: 'Profile', onPress: onBack }, { name: 'Avatar' }]}
        actions={[
          {
            type: 'secondary',
            label: 'Reset',
            onPress: resetStyleDefaults,
            disabled: !initialized,
            overflow: 'never',
          },
          {
            type: 'submit',
            label: 'Save',
            onPress: () => void save(),
            loading: saving,
            disabled: saving || !dirty,
            overflow: 'never',
          },
        ]}
        scroll
        content={({ sx }) => (
          <Box style={sx}>
            <Box sx={{ alignItems: 'center', gap: 2, minHeight: 260 }}>
              <ProfileDiceBearAvatar
                config={previewConfig}
                fallbackSeed={principalId}
                size={192}
                loading={!initialized}
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
                  disabled={!initialized}
                />
                <Button
                  title="Copy seed"
                  variant="outlined"
                  onPress={() => void copySeed()}
                  disabled={!initialized}
                />
              </Box>
              <Text
                variant="caption"
                sx={{ textAlign: 'center', opacity: 0.75 }}
                numberOfLines={1}
                label="Preview updates as you edit. Save to keep changes."
              />
            </Box>

            {initialized ? (
              <>
                <Text variant="label" sx={{ mt: 2 }} label="Style" />
                <TriggerRow
                  label="Avatar style"
                  value={styleLabel(styleKey)}
                  onPress={() => setSurface('style')}
                />
                <ResponsiveSurface
                  visible={surface === 'style'}
                  onClose={closeSurface}
                  title="Choose style"
                >
                  <StylePickerStrip
                    selected={styleKey}
                    seed={draft.seed.trim() || principalId}
                    principalId={principalId}
                    onSelect={(k) => {
                      setDraft((d) => ({ ...d, style: k, options: {} }));
                      closeSurface();
                    }}
                  />
                </ResponsiveSurface>

                {featureEnums.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Text variant="label" label="Features" />
                    {featureEnums.map((f) => {
                      const mode = getEnumSelectionMode(
                        f,
                        draft.options[f.key]
                      );
                      const summary =
                        mode === 'random' ? 'Random' : String(mode);
                      return (
                        <Box key={f.key}>
                          <TriggerRow
                            label={humanizeOptionKey(f.key)}
                            value={summary}
                            onPress={() => setSurface(`enum:${f.key}`)}
                          />
                          <ResponsiveSurface
                            visible={surface === `enum:${f.key}`}
                            onClose={closeSurface}
                            title={humanizeOptionKey(f.key)}
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
                                closeSurface();
                              }}
                            />
                          </ResponsiveSurface>
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}

                {byTab.colors.some((f) => f.kind === 'color') ? (
                  <Box sx={{ mt: 2 }}>
                    <Text variant="label" label="Colors" />
                    {byTab.colors
                      .filter(
                        (f): f is Extract<SchemaField, { kind: 'color' }> =>
                          f.kind === 'color'
                      )
                      .map((f) => {
                        const current = Array.isArray(draft.options[f.key])
                          ? (draft.options[f.key] as string[])
                          : f.default;
                        const summary =
                          current.length === 0
                            ? '—'
                            : `${current.length} selected`;
                        return (
                          <Box key={f.key}>
                            <TriggerRow
                              label={humanizeOptionKey(f.key)}
                              value={summary}
                              onPress={() => setSurface(`color:${f.key}`)}
                            />
                            <ResponsiveSurface
                              visible={surface === `color:${f.key}`}
                              onClose={closeSurface}
                              title={humanizeOptionKey(f.key)}
                            >
                              <MultiSelectSwatchGrid
                                label=""
                                palette={[
                                  ...new Set([...f.default, ...current]),
                                ]}
                                defaultPalette={f.default}
                                value={current}
                                allowTransparent
                                onChange={(next) => {
                                  updateOptions((o) => ({
                                    ...o,
                                    [f.key]: next,
                                  }));
                                }}
                              />
                            </ResponsiveSurface>
                          </Box>
                        );
                      })}
                  </Box>
                ) : null}

                {byTab.effects.some((f) => f.kind === 'probability') ? (
                  <Box sx={{ mt: 2, gap: 2 }}>
                    <Text variant="label" label="Effects" />
                    {byTab.effects
                      .filter(
                        (
                          f
                        ): f is Extract<SchemaField, { kind: 'probability' }> =>
                          f.kind === 'probability'
                      )
                      .map((f) => (
                        <ChipGroup
                          key={f.key}
                          label={humanizeOptionKey(f.key)}
                          options={[
                            { key: 'off', label: 'Off' },
                            { key: 'random', label: 'Random' },
                            { key: 'always', label: 'Always' },
                          ]}
                          selected={getProbabilityMode(draft.options[f.key])}
                          onSelect={(mode) => {
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
                      ))}
                  </Box>
                ) : null}

                <BackgroundBlock
                  fields={byTab.background}
                  draft={draft}
                  updateOptions={updateOptions}
                  surface={surface}
                  setSurface={setSurface}
                  closeSurface={closeSurface}
                />

                <TransformBlock
                  fields={byTab.transform}
                  draft={draft}
                  updateOptions={updateOptions}
                />
              </>
            ) : null}
          </Box>
        )}
      />
    </>
  );
}

function BackgroundBlock({
  fields,
  draft,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => void;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
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

  const bgColors = Array.isArray(o['backgroundColor'])
    ? (o['backgroundColor'] as string[])
    : (colorField?.default ?? []);

  return (
    <Box sx={{ mt: 2, gap: 3 }}>
      <Text variant="label" label="Background" />
      {typeField ? (
        <Box sx={{ gap: 2 }}>
          <Text variant="caption" sx={{ opacity: 0.8 }} label="Type" />
          <SegmentedControl
            segments={[
              { key: 'solid', label: 'Solid' },
              { key: 'gradient', label: 'Gradient' },
              { key: 'both', label: 'Both' },
            ]}
            selected={mode}
            onSelect={(k) => {
              updateOptions((opts) => ({
                ...opts,
                backgroundType: modeToBackgroundType(
                  k as 'solid' | 'gradient' | 'both'
                ),
              }));
            }}
          />
        </Box>
      ) : null}

      {colorField ? (
        <>
          <TriggerRow
            label="Background colors"
            value={bgColors.length === 0 ? '—' : `${bgColors.length} selected`}
            onPress={() => setSurface('bg-color')}
          />
          <ResponsiveSurface
            visible={surface === 'bg-color'}
            onClose={closeSurface}
            title="Background colors"
          >
            <MultiSelectSwatchGrid
              label=""
              palette={[...new Set([...colorField.default, ...bgColors])]}
              defaultPalette={colorField.default}
              value={
                Array.isArray(o['backgroundColor'])
                  ? (o['backgroundColor'] as string[])
                  : colorField.default
              }
              allowTransparent
              onChange={(next) => {
                updateOptions((opts) => ({
                  ...opts,
                  backgroundColor: next,
                }));
              }}
            />
          </ResponsiveSurface>
        </>
      ) : null}

      {rotField ? (
        <Box sx={{ gap: 2, opacity: mode === 'solid' ? 0.45 : 1 }}>
          <Text
            variant="caption"
            sx={{ opacity: 0.8 }}
            label="Gradient rotation (°)"
          />
          <NumberStepper
            label="Min rotation"
            min={rotField.itemMin}
            max={rotField.itemMax}
            disabled={mode === 'solid'}
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
          <NumberStepper
            label="Max rotation"
            min={rotField.itemMin}
            max={rotField.itemMax}
            disabled={mode === 'solid'}
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

function TransformBlock({
  fields,
  draft,
  updateOptions,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: (
    fn: (o: Record<string, unknown>) => Record<string, unknown>
  ) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <Box sx={{ mt: 2, gap: 1 }}>
      <Text variant="label" label="Transform" />
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
            <NumberStepper
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
