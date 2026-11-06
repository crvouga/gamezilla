import { t } from '@lingui/core/macro';
import { type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';
import { P } from '../text/index';

/** Switch between the whole board and precise scrollable cells, keeping navigation guidance visible. */
export function WordTileViewControls(props: {
  enlarged: boolean;
  onChange: (enlarged: boolean) => void;
}): JSX.Element {
  return (
    <>
      <StackHorizontal gap="xs" wrap>
        <Button
          title={t`Fit board`}
          size="sm"
          variant="outline"
          aria-pressed={!props.enlarged}
          onClick={() => props.onChange(false)}
        />
        <Button
          title={t`Enlarge board`}
          size="sm"
          variant="outline"
          aria-pressed={props.enlarged}
          onClick={() => props.onChange(true)}
        />
      </StackHorizontal>
      <Show when={props.enlarged}>
        <P variant="caption">
          {t`Scroll to explore. Arrow keys move between squares; Enter places your selected tile.`}
        </P>
      </Show>
    </>
  );
}
