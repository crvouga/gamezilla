/** @jsxImportSource @solidjs/web */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { IconButton } from '../icon-button/index';

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

/** Centered avatar preview in a recessed seat with an optional corner action. */
export function AvatarHero(props: AvatarHeroProps): JSX.Element {
  const slotSize = () => props.size + ACTION_INSET * 2;

  return (
    <div
      class="box items-center justify-center py-2"
      {...dataAttrs({ component: 'AvatarHero', ...props.dataSet })}
      style={{ 'min-height': cssPx(slotSize() + STAGE_PADDING) }}
    >
      <div
        class="artMount box items-center justify-center rounded-full bg-surface"
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
            <div class="absolute right-0 bottom-0">
              <IconButton
                size={44}
                background="surfaceElevated"
                label={action().label}
                disabled={action().disabled}
                tooltip="none"
                onClick={() => action().onClick()}
              >
                {action().icon}
              </IconButton>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
