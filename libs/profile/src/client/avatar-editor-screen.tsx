import { AvatarEditorSeedField } from './avatar-editor-seed-field';
import { VariantSwatchStrip } from './avatar-editor-variant-swatch-strip';
import { StylePickerStrip } from './avatar-editor-style-picker-strip';
import { ProfileDiceBearAvatar } from './profile-dicebear-avatar';
import type { SchemaField } from './dicebear-schema';
import { humanizeOptionKey } from './option-helpers';
import { useAvatarEditor, type UseAvatarEditor } from './use-avatar-editor';
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
import type { ReactNode } from 'react';

type EnumField = Extract<SchemaField, { kind: 'enum' }>;
type ColorField = Extract<SchemaField, { kind: 'color' }>;

/** ScreenBase body horizontal padding (spacing step 4). */
const SCREEN_PADDING = 16;
const HERO_SIZE = 160;

function PickerBleed({ children }: { children: ReactNode }) {
  return <Box sx={{ mx: -4 }}>{children}</Box>;
}

function TraitPicker({
  field,
  editor,
}: {
  field: EnumField;
  editor: UseAvatarEditor;
}) {
  const { draft, styleKey, seedFallback, updateOptions } = editor;
  return (
    <PickerSection label={humanizeOptionKey(field.key)}>
      <PickerBleed>
        <VariantSwatchStrip
          field={field}
          styleKey={styleKey}
          draft={draft}
          seedFallback={seedFallback}
          contentInsetLeading={SCREEN_PADDING}
          contentInsetTrailing={SCREEN_PADDING}
          onSelect={(variant) => {
            updateOptions((o) => {
              const next = { ...o };
              if (variant === null) {
                delete next[field.key];
              } else {
                next[field.key] = [variant];
              }
              return next;
            });
          }}
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

function AvatarPreviewSlot({ editor }: { editor: UseAvatarEditor }) {
  const { ready, previewConfig, seedFallback } = editor;
  if (!ready) {
    return (
      <Skeleton width={HERO_SIZE} height={HERO_SIZE} borderRadius={HERO_SIZE / 2} />
    );
  }
  return (
    <ProfileDiceBearAvatar
      config={previewConfig}
      fallbackSeed={seedFallback}
      size={HERO_SIZE}
    />
  );
}

function EditorContent({ editor }: { editor: UseAvatarEditor }) {
  const {
    seedFallback,
    ready,
    shuffleSeed,
    draft,
    setDraft,
    styleKey,
    featureEnums,
    colorFields,
    effectiveSeed,
    setSeed,
    copySeed,
  } = editor;

  const seed = draft.seed.trim() || seedFallback;

  return (
    <Box sx={{ gap: 2, pb: 4 }}>
      <AvatarHero size={HERO_SIZE}>
        <AvatarPreviewSlot editor={editor} />
      </AvatarHero>

      {ready ? (
        <Box sx={{ gap: 1 }}>
          <AvatarEditorSeedField
            seed={effectiveSeed}
            onSeedChange={setSeed}
            onRandomize={shuffleSeed}
            onCopy={copySeed}
          />

          <PickerSection label={<Trans>Style</Trans>}>
            <PickerBleed>
              <StylePickerStrip
                selected={styleKey}
                seed={seed}
                seedFallback={seedFallback}
                contentInsetLeading={SCREEN_PADDING}
                contentInsetTrailing={SCREEN_PADDING}
                onSelect={(k) => {
                  setDraft((d) => ({ ...d, style: k, options: {} }));
                }}
              />
            </PickerBleed>
          </PickerSection>

          {featureEnums.map((field) => (
            <TraitPicker key={field.key} field={field} editor={editor} />
          ))}

          {colorFields.map((field) => (
            <BackgroundColorPicker key={field.key} field={field} editor={editor} />
          ))}
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
