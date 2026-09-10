/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * `AvatarHero` -- centered large avatar stage with optional corner action.
 *
 * The corner action is a round 44px `Clickable` (surface plate with a
 * hairline ring) anchored to the bottom-right of the preview slot.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

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

const ACTION_SIZE = 44;
const ACTION_INSET = 4;

export function AvatarHero(props: AvatarHeroProps): JSX.Element {
  const slotSize = () => props.size + ACTION_INSET * 2;

  return (
    <div
      class="box items-center justify-center py-2"
      {...dataAttrs({ component: 'AvatarHero', ...props.dataSet })}
      style={{ 'min-height': cssPx(slotSize() + 16) }}
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
              class="clickable clickableTint absolute right-[0] bottom-[0] rounded-[9999px] border border-border bg-surface items-center justify-center"
              type="button"
              style={{
                width: cssPx(ACTION_SIZE),
                height: cssPx(ACTION_SIZE),
                'min-width': cssPx(ACTION_SIZE),
                'min-height': cssPx(ACTION_SIZE),
                opacity: action().disabled === true ? 0.5 : 1,
              }}
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
