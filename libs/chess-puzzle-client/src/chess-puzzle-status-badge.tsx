import type { JSX } from 'solid-js';

export function ChessPuzzleStatusBadge(props: {
  bg: string;
  fg: string;
  mark: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box w-5 h-5 rounded-md items-center justify-center"
      style={{ 'background-color': props.bg }}
    >
      <p class="text textFootnote textNumeral" style={{ color: props.fg }}>
        {props.mark}
      </p>
    </div>
  );
}
