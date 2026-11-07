import { t } from '@lingui/core/macro';
import type { JSX } from 'solid-js';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';

/** Switch between the whole board and precise scrollable cells, keeping navigation guidance visible. */
export function WordTileViewControls(props: {
  enlarged: boolean;
  onChange: (enlarged: boolean) => void;
}): JSX.Element {
  return (
    <>
      <StackHorizontal gap="xs" wrap>
        <Button
          title={props.enlarged ? t`Fit` : t`Fit board`}
          aria-label={t`Fit board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'outline' : 'solid'}
          aria-pressed={!props.enlarged}
          onClick={() => props.onChange(false)}
        />
        <Button
          title={props.enlarged ? t`Enlarge` : t`Enlarge board`}
          aria-label={t`Enlarge board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'solid' : 'outline'}
          aria-pressed={props.enlarged}
          onClick={() => props.onChange(true)}
        />
      </StackHorizontal>
    </>
  );
}
