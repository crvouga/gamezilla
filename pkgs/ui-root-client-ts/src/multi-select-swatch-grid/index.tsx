/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import { arraysEqualAsSets } from '@pkgs/ui-root-shared-ts/arrays-equal-as-sets';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { TextInput } from '../text-input/index';

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
    <button
      class="clickable clickableTint px-3 py-2 rounded-sm border bg-surface"
      data-component="SwatchRandom"
      type="button"
      style={{
        'border-color': props.isRandom ? colorVar('tint') : colorVar('border'),
      }}
      onClick={() => props.onClick()}
      aria-pressed={props.isRandom}
    >
      <p
        class="text textCaption text-text"
        style={{ 'font-weight': props.isRandom ? '600' : '400' }}
      >
        {<Trans>Random</Trans>}
      </p>
    </button>
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
    <button
      class="clickable clickableTint w-9 h-9 rounded-full border-2 overflow-hidden"
      data-component="Swatch"
      data-hex={props.hex}
      type="button"
      style={{
        'border-color': props.active ? colorVar('tint') : colorVar('border'),
        'background-color': isTrans() ? 'transparent' : `#${props.hex}`,
      }}
      onClick={() => props.onClick()}
      role="checkbox"
      aria-checked={props.active}
      aria-label={isTrans() ? t`Transparent` : t`Color ${props.hex}`}
    >
      <Show when={isTrans()}>
        <div class="box flex-1 bg-border opacity-35" />
      </Show>
    </button>
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
    <div class="box gap-1">
      <p class="text textCaption opacity-80">
        {<Trans>Add hex (6 chars, no #)</Trans>}
      </p>
      <div class="box flex-row gap-2 items-end">
        <div class="box flex-1">
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
        </div>
        <button
          class="clickable clickableTint py-2 px-3"
          data-component="SwatchAddHex"
          type="button"
          onClick={addHex}
        >
          <label class="text textLabel text-tint">{<Trans>Add</Trans>}</label>
        </button>
      </div>
    </div>
  );
}

/**
 * `MultiSelectSwatchGrid` -- multi-select color tokens with optional random
 * preset, transparent swatch, and custom hex entry.
 */
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
    <div
      class="box gap-2 py-2"
      {...dataAttrs({ component: 'MultiSelectSwatchGrid', ...props.dataSet })}
    >
      <label class="text textLabel">{props.label}</label>
      <div class="box flex-row flex-wrap gap-2 items-center" role="group">
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
      </div>
      <Show when={props.allowCustomEntry !== false}>
        <CustomHexInput
          value={props.value}
          onChange={props.onChange}
          validateCustom={validate()}
        />
      </Show>
    </div>
  );
}
