import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  AvatarHero,
  Box,
  Combobox,
  type ComboboxOption,
  ConfirmationModal,
  FormActionsFooter,
  MultiSelectSwatchGrid,
  PickerSection,
  ScreenBase,
  Skeleton,
  Text,
} from '@pkgs/ui-rn';
import { useMemo } from 'react';
import type { AvatarConfig } from '../../../shared/profile/avatar-config';
import { AvatarEditorSeedField } from './avatar-editor-seed-field';
import type { SchemaField } from './dicebear-schema';
import {
  isStyleKey,
  STYLE_KEYS,
  type StyleKey,
  styleLabel,
} from './dicebear-styles';
import {
  buildThumbnailEnumOptions,
  humanizeOptionKey,
  selectedVariantForField,
} from './option-helpers';
import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';
import { type UseAvatarEditor, useAvatarEditor } from './use-avatar-editor';

type EnumField = Extract<SchemaField, { kind: 'enum' }>;
type ColorField = Extract<SchemaField, { kind: 'color' }>;

const HERO_SIZE = 160;
const PREVIEW_SIZE = 32;
const RANDOM = '__random__' as const;

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

function StyleCombobox({
  styleKey,
  seed,
  seedFallback,
  onChange,
}: {
  styleKey: StyleKey;
  seed: string;
  seedFallback: string;
  onChange: (key: StyleKey) => void;
}) {
  const { t } = useLingui();
  const options = useMemo((): ComboboxOption<StyleKey>[] => {
    return STYLE_KEYS.map((key) => {
      const option: ComboboxOption<StyleKey> = {
        value: key,
        label: styleLabel(key),
        searchText: styleLabel(key),
        preview: (
          <ProfileDiceBearAvatar
            config={{ style: key, seed, options: {} }}
            fallbackSeed={seedFallback}
            size={PREVIEW_SIZE}
          />
        ),
      };
      if (key === 'bottts') {
        option.testID = Handles.profileAvatarStyleBottts;
      }
      return option;
    });
  }, [seed, seedFallback]);

  return (
    <Combobox
      label={<Trans>Style</Trans>}
      options={options}
      value={styleKey}
      onValueChange={(key) => {
        if (isStyleKey(key)) onChange(key);
      }}
      placeholder={t`Select style…`}
      searchPlaceholder={t`Search styles…`}
      emptyMessage={t`No matching styles`}
      surfaceTitle={<Trans>Style</Trans>}
      testID={Handles.profileAvatarStyle}
    />
  );
}

function TraitCombobox({
  field,
  styleKey,
  seed,
  options,
  selectedVariant,
  seedFallback,
  triggerTestId,
  onSelect,
}: {
  field: EnumField;
  styleKey: StyleKey;
  seed: string;
  options: Record<string, unknown>;
  selectedVariant: string | null;
  seedFallback: string;
  triggerTestId: string | null;
  onSelect: (variant: string | null) => void;
}) {
  const { t } = useLingui();
  const randomCaption = t`Random`;
  const comboboxOptions = useMemo((): ComboboxOption<string>[] => {
    const random: ComboboxOption<string> = {
      value: RANDOM,
      label: randomCaption,
      searchText: randomCaption,
      preview: (
        <Box
          sx={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" label={<Trans>?</Trans>} />
        </Box>
      ),
    };
    const variants = field.values.map((variant) => ({
      value: variant,
      label: variant.replace(/^variant/i, ''),
      searchText: variant,
      preview: (
        <ProfileDiceBearAvatar
          config={{
            style: styleKey,
            seed,
            options: buildThumbnailEnumOptions(
              styleKey,
              field.key,
              variant,
              options
            ),
          }}
          fallbackSeed={seedFallback}
          size={PREVIEW_SIZE}
        />
      ),
    }));
    return [random, ...variants];
  }, [
    field.key,
    field.values,
    options,
    randomCaption,
    seed,
    seedFallback,
    styleKey,
  ]);

  return (
    <Combobox
      label={humanizeOptionKey(field.key)}
      options={comboboxOptions}
      value={selectedVariant ?? RANDOM}
      onValueChange={(value) => {
        onSelect(value === RANDOM ? null : value);
      }}
      placeholder={t`Select…`}
      searchPlaceholder={t`Search…`}
      emptyMessage={t`No matching options`}
      surfaceTitle={humanizeOptionKey(field.key)}
      {...(triggerTestId !== null ? { testID: triggerTestId } : {})}
    />
  );
}

function StyleAndTraits({
  editor,
  seed,
}: {
  editor: UseAvatarEditor;
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
      <StyleCombobox
        styleKey={styleKey}
        seed={seed}
        seedFallback={seedFallback}
        onChange={(key) => {
          setDraft((d) => ({ ...d, style: key, options: {} }));
        }}
      />
      {featureEnums.map((field, index) => (
        <TraitCombobox
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
          triggerTestId={index === 0 ? Handles.profileAvatarTrait : null}
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
  const heroConfig: AvatarConfig = {
    style: styleKey,
    seed: effectiveSeed,
    options: draft.options,
  };

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
        <Box sx={{ gap: 2 }}>
          <AvatarEditorSeedField
            seed={effectiveSeed}
            onSeedChange={setSeed}
            onRandomize={shuffleSeed}
            onCopy={copySeed}
          />
          <StyleAndTraits editor={editor} seed={seed} />
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
        screenId="avatar-editor"
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onPress: onBack },
          { name: <Trans>Avatar</Trans> },
        ]}
        scroll
        footer={
          <FormActionsFooter
            cancel={{
              label: <Trans>Cancel</Trans>,
              onPress: onBack,
              testID: Handles.profileAvatarCancel,
            }}
            submit={{
              label: <Trans>Save</Trans>,
              loadingLabel: <Trans>Saving…</Trans>,
              successLabel: <Trans>Saved</Trans>,
              errorLabel: <Trans>Couldn't save</Trans>,
              operation: save,
              disabled: !dirty || profileId === null,
              testID: Handles.profileAvatarSave,
            }}
          />
        }
        content={({ sx }) => (
          <Box sx={sx}>
            <EditorContent editor={editor} />
          </Box>
        )}
      />
    </>
  );
}
