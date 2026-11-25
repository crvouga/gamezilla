import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal } from 'solid-js';

/**
 * Secondary recovery and keyboard guidance, available at every viewport:
 * a button under the board that opens the whole help as a centred dialog,
 * so it reads in full without pushing the page or clipping at its foot.
 */
export function NumberlinkDrawingHelp() {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <Button
        title={t`Drawing and keyboard help`}
        intent="neutral"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        dataSet={{ testid: 'numberlink-drawing-help' }}
      />
      <ResponsiveSurface
        visible={open()}
        onClose={() => setOpen(false)}
        presentation="modal"
        title={t`Drawing and keyboard help`}
        size="medium"
      >
        <StackVertical gap="md">
          <P variant="body">
            <Trans>
              Start again at an endpoint to redraw its path. Drag back along
              your path to shorten it. Release to keep your drawing. Move
              outside the board or press Escape to cancel; your saved paths stay
              unchanged. On a small screen, pinch with two fingers to zoom in on
              the board, then draw with one.
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
          <Button
            title={t`Done`}
            variant="outline"
            intent="neutral"
            onClick={() => setOpen(false)}
          />
        </StackVertical>
      </ResponsiveSurface>
    </>
  );
}
