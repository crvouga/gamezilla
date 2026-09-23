import type { JSX } from 'solid-js';

export function ChessPuzzleStatusBadge(props: {
  bg: string;
  fg: string;
  mark: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box w-[20px] h-[20px] rounded-md items-center justify-center"
      style={{ 'background-color': props.bg }}
    >
      <p
        class="text text-[12px] font-bold leading-[14px]"
        style={{ color: props.fg }}
      >
        {props.mark}
      </p>
    </div>
  );
}
