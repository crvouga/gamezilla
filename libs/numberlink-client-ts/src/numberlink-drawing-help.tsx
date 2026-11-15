import { Trans, useLingui } from '@lingui/solid/macro';
import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Show } from 'solid-js';

/** Secondary recovery and keyboard guidance, available at every viewport. */
export function NumberlinkDrawingHelp() {
  const { t } = useLingui();
  return (
    <Collapsible title={t`Drawing and keyboard help`}>
      <NumberlinkDrawingHelpBody />
    </Collapsible>
  );
}

/** What the help says: redrawing, shortening, cancelling, and the keys. */
export function NumberlinkDrawingHelpBody(props: {
  /** Leads with how to draw, where the board does not say it already. */
  withHint?: boolean;
}) {
  const { t } = useLingui();
  return (
    <StackVertical gap="sm">
      <Show when={props.withHint === true}>
        <P variant="caption">
          <Trans>
            Drag from an endpoint to its match, or use Enter and arrow keys.
          </Trans>
        </P>
      </Show>
      <P variant="caption" tone="secondary">
        <Trans>
          Start again at an endpoint to redraw its path. Drag back along your
          path to shorten it. Release to keep your drawing. Move outside the
          board or press Escape to cancel; your saved paths stay unchanged. On a
          small screen, pinch with two fingers to zoom in on the board, then
          draw with one.
        </Trans>
      </P>
      <KeyHints
        testId="numberlink-key-hints"
        hints={[
          { keys: [t`Enter`], label: t`start or end` },
          { keys: [t`Arrows`], label: t`draw` },
          { keys: ['Esc'], label: t`cancel` },
          { keys: ['Del'], label: t`remove` },
        ]}
      />
    </StackVertical>
  );
}
