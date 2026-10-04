import { useTheme } from '@pkgs/ui-client/theme-context';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import type { JSX } from 'solid-js';

export const SPACE_CARD_BORDER_RADIUS = 16;

export function useSpaceCardGradientColors(): readonly [string, string] {
  const theme = useTheme();
  const fill = theme.colors.tintActive;
  return [fill, fill];
}

export type SpaceCardGradientBoxProps = {
  children: JSX.Element;
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** Flat tint surface — nuclear overhaul (no LinearGradient / elevation). */
export function SpaceCardGradientBox(
  props: SpaceCardGradientBoxProps
): JSX.Element {
  const [fill] = useSpaceCardGradientColors();

  return (
    <div
      class={`box ${props.class ?? ''}`.trim()}
      style={{
        'background-color': fill,
        'border-radius': `${SPACE_CARD_BORDER_RADIUS}px`,
        width: '100%',
        'align-self': 'stretch',
        ...props.style,
      }}
      {...dataAttrs(props.dataSet)}
    >
      {props.children}
    </div>
  );
}
