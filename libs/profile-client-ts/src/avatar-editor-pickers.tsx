import type { SchemaField } from '@libs/profile-shared-ts/dicebear-schema';
import type { StyleKey } from '@libs/profile-shared-ts/dicebear-styles';
import {
  isStyleKey,
  STYLE_KEYS,
  styleLabel,
} from '@libs/profile-shared-ts/dicebear-styles';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { ShuffleIcon } from '@pkgs/ui-root-client-ts/icons';
import { MultiSelectSwatchGrid } from '@pkgs/ui-root-client-ts/multi-select-swatch-grid';
import { PickerSection } from '@pkgs/ui-root-client-ts/picker-section';
import type { ComboboxOption } from '@pkgs/ui-root-shared-ts/combobox-types';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { buildThumbnailEnumOptions, humanizeOptionKey } from './option-helpers';
import { ProfileDiceBearAvatar } from './patch-avatar-profile-dicebear-avatar';
import type { UseAvatarEditor } from './use-avatar-editor';

/** The pickers of the avatar editor: style, each trait, background colors. */

type EnumField = Extract<SchemaField, { kind: 'enum' }>;
type ColorField = Extract<SchemaField, { kind: 'color' }>;

const PREVIEW_SIZE = 32;
const RANDOM = '__random__' as const;

export function BackgroundColorPicker(props: {
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

export function StyleCombobox(props: {
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
        dataSet: { testid: Handles.profileAvatarStyleOption(key) },
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

export function TraitCombobox(props: {
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
      preview: <Avatar size={PREVIEW_SIZE} icon={ShuffleIcon} ring={false} />,
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
