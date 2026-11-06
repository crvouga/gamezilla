import { Trans } from '@lingui/solid/macro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

/**
 * Beside the board preview: how the game is played, in its own words, so
 * the card paired with the players says what the game is about. Wide, under
 * the preview with its heading, centred like the preview above it; on a
 * phone the line itself beside the slim preview's thumbnail, in place of
 * the bare `Board preview` label.
 */
export function FrameAboutView(props: {
  readonly about: (() => JSX.Element) | undefined;
}): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={props.about}>
      {(about) => (
        // On a phone it takes the row beside the thumbnail; wide it keeps
        // its own height, so the card centres the board and it together.
        <StackVertical
          gap="xs"
          grow={mode() !== 'wide'}
          testId="custom-game-about"
        >
          <Show when={mode() === 'wide'}>
            <P variant="label" align="center">
              <Trans>How to play</Trans>
            </P>
          </Show>
          <P
            variant="caption"
            tone="secondary"
            align={mode() === 'wide' ? 'center' : undefined}
          >
            <Dynamic component={about()} />
          </P>
        </StackVertical>
      )}
    </Show>
  );
}
