/** @jsxImportSource solid-js */
/**
 * `MultiSelectSwatchGrid` -- multi-select color tokens with optional random
 * preset, transparent swatch, and custom hex entry.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import { createSignal, For, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';
import { TextInput } from '../text-input';
import { arraysEqualAsSets } from './arrays-equal-as-sets';

const DEFAULT_HEX = /^[0-9a-fA-F]{6}$/;

export type MultiSelectSwatchGridProps = {
  label: JSX.Element;
  palette: readonly string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  allowTransparent?: boolean | undefined;
  /** When current `value` matches this multiset (case-insensitive), "Random" is highlighted. */
  defaultPalette?: readonly string[] | undefined;
  allowCustomEntry?: boolean | undefined;
  validateCustom?: ((token: string) => boolean) | undefined;
  /** Token stored in `value` for the transparent swatch. */
  transparentToken?: string | undefined;
  renderSwatch?:
    | ((
        colorToken: string,
        active: boolean,
        onClick: () => void
      ) => JSX.Element)
    | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function isSwatchSelected(
  value: readonly string[],
  token: string
): boolean {
  const lower = token.toLowerCase();
  return value.some((v) => v.toLowerCase() === lower);
}

export function uniqueLowerPalette(palette: readonly string[]): string[] {
  const s = new Set<string>();
  for (const c of palette) s.add(c.toLowerCase());
  return [...s];
}

/** Pure toggle: remove when present (case-insensitive), else append. */
export function toggleSwatch(value: readonly string[], hex: string): string[] {
  const lower = hex.toLowerCase();
  return value.some((v) => v.toLowerCase() === lower)
    ? value.filter((v) => v.toLowerCase() !== lower)
    : [...value, hex];
}

function RandomChip(props: { isRandom: boolean; onClick: () => void }) {
  return (
    <Clickable
      onClick={() => props.onClick()}
      aria-pressed={props.isRandom}
      dataSet={{ component: 'SwatchRandom' }}
      sx={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: props.isRandom ? 'tint' : 'border',
        backgroundColor: 'surface',
      }}
    >
      <Text
        variant="caption"
        sx={{ fontWeight: props.isRandom ? '600' : '400', color: 'text' }}
        label={<Trans>Random</Trans>}
      />
    </Clickable>
  );
}

function DefaultSwatch(props: {
  hex: string;
  active: boolean;
  onClick: () => void;
  transparentToken: string;
}): JSX.Element {
  const { t } = useLingui();
  const isTrans = (): boolean =>
    props.hex.toLowerCase() === props.transparentToken.toLowerCase();
  return (
    <Clickable
      onClick={() => props.onClick()}
      role="checkbox"
      aria-checked={props.active}
      aria-label={isTrans() ? t`Transparent` : t`Color ${props.hex}`}
      dataSet={{ component: 'Swatch', hex: props.hex }}
      sx={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: props.active ? 'tint' : 'border',
        backgroundColor: isTrans() ? 'transparent' : `#${props.hex}`,
        overflow: 'hidden',
      }}
    >
      <Show when={isTrans()}>
        <Box sx={{ flex: 1, backgroundColor: 'border', opacity: 0.35 }} />
      </Show>
    </Clickable>
  );
}

function SwatchSlot(props: {
  hex: string;
  active: boolean;
  onClick: () => void;
  transparentToken: string;
  renderSwatch: MultiSelectSwatchGridProps['renderSwatch'];
}): JSX.Element {
  return (
    <Show
      when={props.renderSwatch}
      fallback={
        <DefaultSwatch
          hex={props.hex}
          active={props.active}
          onClick={props.onClick}
          transparentToken={props.transparentToken}
        />
      }
    >
      {(render) => render()(props.hex, props.active, props.onClick)}
    </Show>
  );
}

function CustomHexInput(props: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  validateCustom: (token: string) => boolean;
}): JSX.Element {
  const { t } = useLingui();
  const [hexDraft, setHexDraft] = createSignal('');
  const addHex = (): void => {
    const token = hexDraft().trim().toLowerCase();
    if (!props.validateCustom(token)) return;
    if (!props.value.map((v) => v.toLowerCase()).includes(token)) {
      props.onChange([...props.value, token]);
    }
    setHexDraft('');
  };
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="caption"
        sx={{ opacity: 0.8 }}
        label={<Trans>Add hex (6 chars, no #)</Trans>}
      />
      <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ flex: 1 }}>
          <TextInput
            value={hexDraft()}
            onChangeText={setHexDraft}
            onSubmitEditing={addHex}
            placeholder={t`e.g. ff5733`}
            aria-label={t`Custom hex color`}
            autocapitalize="off"
            autocorrect="off"
            maxLength={6}
          />
        </Box>
        <Clickable
          onClick={addHex}
          dataSet={{ component: 'SwatchAddHex' }}
          sx={{ paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Text
            variant="label"
            sx={{ color: 'tint' }}
            label={<Trans>Add</Trans>}
          />
        </Clickable>
      </Box>
    </Box>
  );
}

export function MultiSelectSwatchGrid(
  props: MultiSelectSwatchGridProps
): JSX.Element {
  const transparentToken = (): string =>
    props.transparentToken ?? 'transparent';
  const validate = (): ((s: string) => boolean) =>
    props.validateCustom ?? ((s) => DEFAULT_HEX.test(s));
  const toggle = (hex: string): void =>
    props.onChange(toggleSwatch(props.value, hex));
  const isRandom = (): boolean =>
    props.defaultPalette !== undefined &&
    arraysEqualAsSets(
      props.value.map((v) => v.toLowerCase()),
      props.defaultPalette.map((v) => v.toLowerCase())
    );
  return (
    <Box
      sx={{ gap: 2, py: 2 }}
      dataSet={{ component: 'MultiSelectSwatchGrid', ...props.dataSet }}
    >
      <Text variant="label" label={props.label} />
      <Box
        role="group"
        sx={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Show when={props.defaultPalette}>
          {(palette) => (
            <RandomChip
              isRandom={isRandom()}
              onClick={() => props.onChange([...palette()])}
            />
          )}
        </Show>
        <Show when={props.allowTransparent === true}>
          <SwatchSlot
            hex={transparentToken()}
            active={isSwatchSelected(props.value, transparentToken())}
            onClick={() => toggle(transparentToken())}
            transparentToken={transparentToken()}
            renderSwatch={props.renderSwatch}
          />
        </Show>
        <For each={uniqueLowerPalette(props.palette)}>
          {(hex) => (
            <SwatchSlot
              hex={hex}
              active={isSwatchSelected(props.value, hex)}
              onClick={() => toggle(hex)}
              transparentToken={transparentToken()}
              renderSwatch={props.renderSwatch}
            />
          )}
        </For>
      </Box>
      <Show when={props.allowCustomEntry !== false}>
        <CustomHexInput
          value={props.value}
          onChange={props.onChange}
          validateCustom={validate()}
        />
      </Show>
    </Box>
  );
}
