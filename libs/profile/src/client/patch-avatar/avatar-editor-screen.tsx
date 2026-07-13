import { AvatarEditorSeedField } from '../avatar-editor-seed-field';
import {
  VariantSwatchStrip,
  selectedVariantForField,
} from '../avatar-editor-variant-swatch-strip';
import { StylePickerStrip } from '../avatar-editor-style-picker-strip';
import { ProfileDiceBearAvatar } from '../profile-dicebear-avatar';
import type { SchemaField } from '../dicebear-schema';
import { isStyleKey, type StyleKey } from '../dicebear-styles';
import { humanizeOptionKey } from '../option-helpers';
import { useAvatarEditor, type UseAvatarEditor } from './use-avatar-editor';
import type { AvatarConfig } from '../../shared/avatar-config';
import {
  AvatarHero,
  Box,
  ConfirmationModal,
  FormActionsFooter,
  MultiSelectSwatchGrid,
  PickerSection,
  ScreenBase,
  Skeleton,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type EnumField = Extract<SchemaField, { kind: 'enum' }>;
type ColorField = Extract<SchemaField, { kind: 'color' }>;

const HERO_SIZE = 160;

function PickerBleed({ children }: { children: ReactNode }) {
  return <Box sx={{ mx: -4 }}>{children}</Box>;
}

function TraitPicker({
  field,
  styleKey,
  seed,
  options,
  selectedVariant,
  seedFallback,
  onSelect,
}: {
  field: EnumField;
  styleKey: StyleKey;
  seed: string;
  options: Record<string, unknown>;
  selectedVariant: string | null;
  seedFallback: string;
  onSelect: (variant: string | null) => void;
}) {
  return (
    <PickerSection label={humanizeOptionKey(field.key)}>
      <PickerBleed>
        <VariantSwatchStrip
          field={field}
          styleKey={styleKey}
          seed={seed}
          options={options}
          selectedVariant={selectedVariant}
          seedFallback={seedFallback}
          onSelect={onSelect}
        />
      </PickerBleed>
    </PickerSection>
  );
}

function BackgroundColorPicker({
  field,
  editor,
}: {
  field: ColorField;
  editor: UseAvatarEditor;
}) {
  const { draft, updateOptions } = editor;
  const current = Array.isArray(draft.options[field.key])
    ? (draft.options[field.key] as string[])
    : field.default;

  return (
    <PickerSection label={humanizeOptionKey(field.key)}>
      <MultiSelectSwatchGrid
        label={null}
        palette={[...new Set([...field.default, ...current])]}
        defaultPalette={field.default}
        value={current}
        allowTransparent
        allowCustomEntry={false}
        onChange={(next) => {
          updateOptions((o) => ({
            ...o,
            [field.key]: next.length <= 1 ? next : [next[next.length - 1]!],
          }));
        }}
      />
    </PickerSection>
  );
}

function AvatarPreviewSlot({
  ready,
  config,
  seedFallback,
}: {
  ready: boolean;
  config: AvatarConfig;
  seedFallback: string;
}) {
  if (!ready) {
    return (
      <Skeleton
        width={HERO_SIZE}
        height={HERO_SIZE}
        borderRadius={HERO_SIZE / 2}
      />
    );
  }
  return (
    <ProfileDiceBearAvatar
      config={config}
      fallbackSeed={seedFallback}
      size={HERO_SIZE}
    />
  );
}

function useLiveStylePreview(
  styleKey: StyleKey,
  effectiveSeed: string,
  options: Record<string, unknown>
) {
  const [liveStyle, setLiveStyle] = useState<StyleKey>(styleKey);
  useEffect(() => {
    setLiveStyle(styleKey);
  }, [styleKey]);
  const heroConfig = useMemo((): AvatarConfig => {
    const committed = liveStyle === styleKey;
    return {
      style: liveStyle,
      seed: effectiveSeed,
      options: committed ? options : {},
    };
  }, [liveStyle, styleKey, effectiveSeed, options]);
  return { liveStyle, setLiveStyle, heroConfig };
}

function StyleAndTraits({
  editor,
  liveStyle,
  setLiveStyle,
  seed,
}: {
  editor: UseAvatarEditor;
  liveStyle: StyleKey;
  setLiveStyle: (k: StyleKey) => void;
  seed: string;
}) {
  const {
    seedFallback,
    setDraft,
    styleKey,
    featureEnums,
    colorFields,
    draft,
    updateOptions,
  } = editor;
  return (
    <>
      <PickerSection label={<Trans>Style</Trans>}>
        <PickerBleed>
          <StylePickerStrip
            selected={liveStyle}
            seed={seed}
            seedFallback={seedFallback}
            onSelect={(k) => {
              if (isStyleKey(k)) setLiveStyle(k);
            }}
            onSettle={(k) => {
              setDraft((d) => ({ ...d, style: k, options: {} }));
            }}
          />
        </PickerBleed>
      </PickerSection>
      {featureEnums.map((field) => (
        <TraitPicker
          key={`${styleKey}:${field.key}`}
          field={field}
          styleKey={styleKey}
          seed={seed}
          options={draft.options}
          selectedVariant={selectedVariantForField(
            field,
            draft.options[field.key]
          )}
          seedFallback={seedFallback}
          onSelect={(variant) => {
            updateOptions((o) => {
              const next = { ...o };
              if (variant === null) delete next[field.key];
              else next[field.key] = [variant];
              return next;
            });
          }}
        />
      ))}
      {colorFields.map((field) => (
        <BackgroundColorPicker key={field.key} field={field} editor={editor} />
      ))}
    </>
  );
}

function EditorContent({ editor }: { editor: UseAvatarEditor }) {
  const {
    seedFallback,
    ready,
    shuffleSeed,
    draft,
    styleKey,
    effectiveSeed,
    setSeed,
    copySeed,
  } = editor;
  const seed = draft.seed.trim() || seedFallback;
  const { liveStyle, setLiveStyle, heroConfig } = useLiveStylePreview(
    styleKey,
    effectiveSeed,
    draft.options
  );

  return (
    <Box sx={{ gap: 2, pb: 4 }}>
      <AvatarHero size={HERO_SIZE}>
        <AvatarPreviewSlot
          ready={ready}
          config={heroConfig}
          seedFallback={seedFallback}
        />
      </AvatarHero>
      {ready ? (
        <Box sx={{ gap: 1 }}>
          <AvatarEditorSeedField
            seed={effectiveSeed}
            onSeedChange={setSeed}
            onRandomize={shuffleSeed}
            onCopy={copySeed}
          />
          <StyleAndTraits
            editor={editor}
            liveStyle={liveStyle}
            setLiveStyle={setLiveStyle}
            seed={seed}
          />
        </Box>
      ) : null}
    </Box>
  );
}

export function AvatarEditorScreen() {
  const editor = useAvatarEditor();
  const {
    profileId,
    showDiscard,
    setShowDiscard,
    confirmDiscard,
    onBack,
    dirty,
    save,
  } = editor;

  return (
    <>
      <ConfirmationModal
        visible={showDiscard}
        title={<Trans>Discard changes?</Trans>}
        message={<Trans>You have unsaved avatar changes.</Trans>}
        confirmLabel={<Trans>Discard</Trans>}
        variant="destructive"
        onConfirm={confirmDiscard}
        onCancel={() => setShowDiscard(false)}
      />
      <ScreenBase
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onPress: onBack },
          { name: <Trans>Avatar</Trans> },
        ]}
        scroll
        footer={
          <FormActionsFooter
            cancel={{ label: <Trans>Cancel</Trans>, onPress: onBack }}
            submit={{
              label: <Trans>Save</Trans>,
              loadingLabel: <Trans>Saving…</Trans>,
              successLabel: <Trans>Saved</Trans>,
              errorLabel: <Trans>Couldn't save</Trans>,
              operation: save,
              disabled: !dirty || profileId === null,
            }}
          />
        }
        content={({ sx }) => (
          <Box style={sx}>
            <EditorContent editor={editor} />
          </Box>
        )}
      />
    </>
  );
}
