import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  AvatarHero,
  Combobox,
  type ComboboxOption,
  ConfirmationModal,
  FormActionsFooter,
  MultiSelectSwatchGrid,
  PickerSection,
  ScreenBase,
  Skeleton,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, For, Show } from 'solid-js';
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

function BackgroundColorPicker(props: {
  field: ColorField;
  editor: UseAvatarEditor;
}): JSX.Element {
  const current = (): string[] => {
    const value = props.editor.draft.options[props.field.key];
    return Array.isArray(value) ? (value as string[]) : props.field.default;
  };
  const palette = (): string[] => [
    ...new Set([...props.field.default, ...current()]),
  ];
  return (
    <PickerSection label={humanizeOptionKey(props.field.key)}>
      <MultiSelectSwatchGrid
        label={null}
        palette={palette()}
        defaultPalette={props.field.default}
        value={current()}
        allowTransparent
        allowCustomEntry={false}
        onChange={(next) => {
          const key = props.field.key;
          props.editor.updateOptions((o) => ({
            ...o,
            [key]: next.length <= 1 ? next : [next[next.length - 1]!],
          }));
        }}
      />
    </PickerSection>
  );
}

function AvatarPreviewSlot(props: {
  ready: boolean;
  config: AvatarConfig;
  seedFallback: string;
}): JSX.Element {
  return (
    <Show
      when={props.ready}
      fallback={
        <Skeleton
          width={HERO_SIZE}
          height={HERO_SIZE}
          borderRadius={HERO_SIZE / 2}
        />
      }
    >
      <ProfileDiceBearAvatar
        config={props.config}
        fallbackSeed={props.seedFallback}
        size={HERO_SIZE}
      />
    </Show>
  );
}

function StyleCombobox(props: {
  styleKey: StyleKey;
  seed: string;
  seedFallback: string;
  onChange: (key: StyleKey) => void;
}): JSX.Element {
  const { t } = useLingui();
  const options = createMemo((): ComboboxOption<StyleKey>[] =>
    STYLE_KEYS.map((key) => {
      const option: ComboboxOption<StyleKey> = {
        value: key,
        label: styleLabel(key),
        searchText: styleLabel(key),
        ...(key === 'bottts'
          ? { dataSet: { testid: Handles.profileAvatarStyleBottts } }
          : {}),
        preview: (
          <ProfileDiceBearAvatar
            config={{ style: key, seed: props.seed, options: {} }}
            fallbackSeed={props.seedFallback}
            size={PREVIEW_SIZE}
          />
        ),
      };
      return option;
    })
  );

  return (
    <Combobox
      label={<Trans>Style</Trans>}
      options={options()}
      value={props.styleKey}
      onValueChange={(key) => {
        if (isStyleKey(key)) props.onChange(key);
      }}
      placeholder={t`Select style…`}
      searchPlaceholder={t`Search styles…`}
      emptyMessage={t`No matching styles`}
      surfaceTitle={<Trans>Style</Trans>}
      triggerDataSet={{ testid: Handles.profileAvatarStyle }}
      searchDataSet={{ testid: Handles.profileAvatarStyleSearch }}
    />
  );
}

function TraitCombobox(props: {
  field: EnumField;
  styleKey: StyleKey;
  seed: string;
  options: Record<string, unknown>;
  selectedVariant: string | null;
  seedFallback: string;
  triggerTestId: string | null;
  onSelect: (variant: string | null) => void;
}): JSX.Element {
  const { t } = useLingui();
  const comboboxOptions = createMemo((): ComboboxOption<string>[] => {
    const random: ComboboxOption<string> = {
      value: RANDOM,
      label: t`Random`,
      searchText: t`Random`,
      preview: (
        <div
          class="box items-center justify-center"
          style={{ width: `${PREVIEW_SIZE}px`, height: `${PREVIEW_SIZE}px` }}
        >
          <p class="text textCaption">{<Trans>?</Trans>}</p>
        </div>
      ),
    };
    const variants = props.field.values.map((variant) => ({
      value: variant,
      label: variant.replace(/^variant/i, ''),
      searchText: variant,
      preview: (
        <ProfileDiceBearAvatar
          config={{
            style: props.styleKey,
            seed: props.seed,
            options: buildThumbnailEnumOptions(
              props.styleKey,
              props.field.key,
              variant,
              props.options
            ),
          }}
          fallbackSeed={props.seedFallback}
          size={PREVIEW_SIZE}
        />
      ),
    }));
    return [random, ...variants];
  });

  return (
    <Combobox
      label={humanizeOptionKey(props.field.key)}
      options={comboboxOptions()}
      value={props.selectedVariant ?? RANDOM}
      onValueChange={(value) => {
        props.onSelect(value === RANDOM ? null : value);
      }}
      placeholder={t`Select…`}
      searchPlaceholder={t`Search…`}
      emptyMessage={t`No matching options`}
      surfaceTitle={humanizeOptionKey(props.field.key)}
      triggerDataSet={
        props.triggerTestId !== null
          ? { testid: props.triggerTestId }
          : undefined
      }
    />
  );
}

function StyleAndTraits(props: {
  editor: UseAvatarEditor;
  seed: string;
}): JSX.Element {
  return (
    <>
      <StyleCombobox
        styleKey={props.editor.styleKey}
        seed={props.seed}
        seedFallback={props.editor.seedFallback}
        onChange={(key) => {
          props.editor.setDraft((d) => ({ ...d, style: key, options: {} }));
        }}
      />
      <For each={props.editor.featureEnums}>
        {(field, index) => (
          <TraitCombobox
            field={field}
            styleKey={props.editor.styleKey}
            seed={props.seed}
            options={props.editor.draft.options}
            selectedVariant={selectedVariantForField(
              field,
              props.editor.draft.options[field.key]
            )}
            seedFallback={props.editor.seedFallback}
            triggerTestId={index() === 0 ? Handles.profileAvatarTrait : null}
            onSelect={(variant) => {
              props.editor.updateOptions((o) => {
                const next = { ...o };
                if (variant === null) delete next[field.key];
                else next[field.key] = [variant];
                return next;
              });
            }}
          />
        )}
      </For>
      <For each={props.editor.colorFields}>
        {(field) => (
          <BackgroundColorPicker field={field} editor={props.editor} />
        )}
      </For>
    </>
  );
}

function EditorContent(props: { editor: UseAvatarEditor }): JSX.Element {
  const seed = () =>
    props.editor.draft.seed.trim() || props.editor.seedFallback;
  const heroConfig = createMemo<AvatarConfig>(() => ({
    style: props.editor.styleKey,
    seed: props.editor.effectiveSeed,
    options: props.editor.draft.options,
  }));

  return (
    <div class="box gap-2 pb-4">
      <AvatarHero size={HERO_SIZE}>
        <AvatarPreviewSlot
          ready={props.editor.ready}
          config={heroConfig()}
          seedFallback={props.editor.seedFallback}
        />
      </AvatarHero>
      <Show when={props.editor.ready}>
        <div class="box gap-2">
          <AvatarEditorSeedField
            seed={props.editor.effectiveSeed}
            onSeedChange={props.editor.setSeed}
            onRandomize={props.editor.shuffleSeed}
            onCopy={props.editor.copySeed}
          />
          <StyleAndTraits editor={props.editor} seed={seed()} />
        </div>
      </Show>
    </div>
  );
}

export function AvatarEditorScreen(): JSX.Element {
  const editor = useAvatarEditor();

  return (
    <>
      <ConfirmationModal
        visible={editor.showDiscard}
        title={<Trans>Discard changes?</Trans>}
        message={<Trans>You have unsaved avatar changes.</Trans>}
        confirmLabel={<Trans>Discard</Trans>}
        variant="destructive"
        onConfirm={editor.confirmDiscard}
        onCancel={() => editor.setShowDiscard(false)}
      />
      <ScreenBase
        screenId="avatar-editor"
        breadcrumbs={[
          { name: <Trans>Profile</Trans>, onClick: editor.onBack },
          { name: <Trans>Avatar</Trans> },
        ]}
        scroll
        footer={
          <FormActionsFooter
            cancel={{
              label: <Trans>Cancel</Trans>,
              onClick: editor.onBack,
              dataSet: { testid: Handles.profileAvatarCancel },
            }}
            submit={{
              label: <Trans>Save</Trans>,
              loadingLabel: <Trans>Saving…</Trans>,
              successLabel: <Trans>Saved</Trans>,
              errorLabel: <Trans>Couldn't save</Trans>,
              operation: editor.save,
              get disabled() {
                return !editor.dirty || editor.profileId === null;
              },
              dataSet: { testid: Handles.profileAvatarSave },
            }}
          />
        }
        content={({ bodyClass }) => (
          <div class={`box ${bodyClass}`}>
            <EditorContent editor={editor} />
          </div>
        )}
      />
    </>
  );
}
