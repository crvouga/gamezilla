/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H1 } from '@pkgs/ui-root-client-ts/heading';
import { CompassIcon, Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import { ScreenBase } from '@pkgs/ui-root-client-ts/screen-base';
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
  /** Return where the person was; only when the app has a screen to return to. */
  readonly onGoBack?: (() => void) | undefined;
};

/**
 * The `*` route: one message, centred in the content area as a single
 * unit. The page title ("Page not found", the screen's one heading) heads
 * it, then the compass, why it happened without repeating the title, and
 * at most two ways out side by side: Go to Spaces (home), and Go back when
 * there is somewhere to go back to. The header draws no title of its own.
 */
export function NotFoundScreenView(
  props: NotFoundScreenViewProps
): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={[{ name: props.title }]}
      titlePlacement="content"
      content={() => (
        <StateBlock dataSet={{ testid: Handles.routeNotFound }}>
          <StateBlockIcon icon={CompassIcon} />
          <H1 align="center">{props.title}</H1>
          <P variant="body" tone="secondary" align="center">
            <Trans>
              The link may be old or mistyped. Your spaces are still here.
            </Trans>
          </P>
          <StateBlockActions>
            <Button
              title={<Trans>Go to Spaces</Trans>}
              icon={Gamepad2Icon}
              onClick={() => props.onGoToSpaces()}
              dataSet={{ testid: Handles.routeNotFoundAction }}
            />
            <Show when={props.onGoBack}>
              {(goBack) => (
                <Button
                  title={<Trans>Go back</Trans>}
                  intent="neutral"
                  variant="outline"
                  onClick={() => goBack()()}
                />
              )}
            </Show>
          </StateBlockActions>
        </StateBlock>
      )}
    />
  );
}
