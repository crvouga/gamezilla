/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
/**
 * `AvatarHero` -- centered large avatar stage with optional corner action.
 *
 * The corner action is a round 44px button (the canvas inside a hairline
 * ring, like a panel) anchored to the bottom-right of the preview slot, with
 * the hover / press tint, the focus ring and the disabled opacity.
 */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type AvatarHeroAction = {
  onClick: () => void;
  icon: JSX.Element;
  /** Accessible name of the action button. */
  label: LocalizedString;
  disabled?: boolean | undefined;
};

export type AvatarHeroProps = {
  /** Diameter of the preview slot in pixels. */
  size: number;
  children: JSX.Element;
  action?: AvatarHeroAction | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Room around the face for the corner action to overlap (`py-2` stage). */
const ACTION_INSET = 4;
const STAGE_PADDING = 16;

export function AvatarHero(props: AvatarHeroProps): JSX.Element {
  const slotSize = () => props.size + ACTION_INSET * 2;

  return (
    <div
      class="box items-center justify-center py-2"
      {...dataAttrs({ component: 'AvatarHero', ...props.dataSet })}
      style={{ 'min-height': cssPx(slotSize() + STAGE_PADDING) }}
    >
      <div
        class="box"
        style={{ width: cssPx(slotSize()), height: cssPx(slotSize()) }}
      >
        <div
          class="box items-center justify-center self-center"
          style={{ width: cssPx(props.size), height: cssPx(props.size) }}
        >
          {props.children}
        </div>
        <Show when={props.action}>
          {(action) => (
            <button
              class="clickable clickableTint absolute right-0 bottom-0 size-11 min-w-11 min-h-11 rounded-full border border-border bg-background items-center justify-center"
              classList={{ 'opacity-disabled': action().disabled === true }}
              type="button"
              aria-label={action().label}
              disabled={action().disabled === true}
              onClick={() => action().onClick()}
            >
              {action().icon}
            </button>
          )}
        </Show>
      </div>
    </div>
  );
}
