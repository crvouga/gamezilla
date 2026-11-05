/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CompassIcon,
  Gamepad2Icon,
  SearchIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  StateBlock,
  StateBlockActions,
  StateBlockIcon,
} from '@pkgs/ui-root-client-ts/state-block';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export type NotFoundScreenViewProps = {
  /** Stable DOM `data-screen` id. */
  readonly screenId: string;
  /** The page title, the screen's one heading. */
  readonly title: JSX.Element;
  /** Spaces, the app's home: the primary way out. */
  readonly onGoToSpaces: () => void;
  readonly onGoToSearch: () => void;
  readonly onGoToProfile: () => void;
  /** Return where the person was; only when the app has a screen to return to. */
  readonly onGoBack?: (() => void) | undefined;
};

/**
 * The `*` route: the page title says it ("Not found") once, then, centred
 * in the content area, why and where to go instead: Spaces first, then
 * Search and Profile, and Go back when there is somewhere to go back to.
 */
export function NotFoundScreenView(
  props: NotFoundScreenViewProps
): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={[{ name: props.title }]}
      content={() => (
        <StackVertical grow>
          <StateBlock dataSet={{ testid: Handles.routeNotFound }}>
            <StateBlockIcon icon={CompassIcon} />
            <P variant="body" tone="secondary" align="center">
              <Trans>
                There's nothing at this address. The link may be old or
                mistyped; your spaces are still here.
              </Trans>
            </P>
            <StateBlockActions>
              <Button
                title={<Trans>Go to Spaces</Trans>}
                icon={Gamepad2Icon}
                onClick={() => props.onGoToSpaces()}
                dataSet={{ testid: Handles.routeNotFoundAction }}
              />
              <Button
                title={<Trans>Search</Trans>}
                icon={SearchIcon}
                intent="neutral"
                variant="outline"
                onClick={() => props.onGoToSearch()}
              />
              <Button
                title={<Trans>Profile</Trans>}
                icon={UserIcon}
                intent="neutral"
                variant="outline"
                onClick={() => props.onGoToProfile()}
              />
            </StateBlockActions>
            <Show when={props.onGoBack}>
              {(goBack) => (
                <Button
                  title={<Trans>Go back</Trans>}
                  intent="neutral"
                  variant="ghost"
                  onClick={() => goBack()()}
                />
              )}
            </Show>
          </StateBlock>
        </StackVertical>
      )}
    />
  );
}
