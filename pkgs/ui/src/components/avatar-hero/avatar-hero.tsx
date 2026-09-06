/** @jsxImportSource solid-js */
/**
 * `AvatarHero` -- centered large avatar stage with optional corner action.
 *
 * The corner action is a round 44px `Clickable` (surface plate with a
 * hairline ring) anchored to the bottom-right of the preview slot.
 */

import type { LocalizedString } from '@pkgs/i18n';
import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Center } from '../center';
import { Clickable } from '../clickable';

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
    <Center
      dataSet={{ component: 'AvatarHero', ...props.dataSet }}
      sx={{ py: 2, minHeight: slotSize() + 16 }}
    >
      <Box sx={{ width: slotSize(), height: slotSize() }}>
        <Center
          sx={{ width: props.size, height: props.size, alignSelf: 'center' }}
        >
          {props.children}
        </Center>
        <Show when={props.action}>
          {(action) => (
            <Clickable
              aria-label={action().label}
              disabled={action().disabled === true}
              onClick={() => action().onClick()}
              sx={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: ACTION_SIZE,
                height: ACTION_SIZE,
                minWidth: ACTION_SIZE,
                minHeight: ACTION_SIZE,
                borderRadius: 'full',
                borderWidth: 1,
                borderColor: 'border',
                backgroundColor: 'surface',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: action().disabled === true ? 0.5 : 1,
              }}
            >
              {action().icon}
            </Clickable>
          )}
        </Show>
      </Box>
    </Center>
  );
}
