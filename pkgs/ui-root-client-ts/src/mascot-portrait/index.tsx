import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createContext, useContext } from 'solid-js';
import type { IconProps } from '../create-icon/index';

/** Product hosts supply their configured app mark. Standalone stories use the source portrait. */
export const MascotSource = createContext(
  new URL('../../assets/mascot/portrait.svg', import.meta.url).href
);

export function MascotPortrait(
  props: Pick<IconProps, 'size' | 'dataSet'>
): JSX.Element {
  const src = useContext(MascotSource);
  return (
    <img
      {...componentDataAttrs('MascotPortrait', props.dataSet)}
      src={src}
      alt=""
      aria-hidden="true"
      width={props.size ?? 32}
      height={props.size ?? 32}
      class="shrink-0"
    />
  );
}
