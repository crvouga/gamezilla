import { type ComponentDataSet, dataAttrs, useTheme } from '@pkgs/ui';
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
        ...props.style,
      }}
      {...dataAttrs(props.dataSet)}
    >
      {props.children}
    </div>
  );
}
