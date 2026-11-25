import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

export const CHIP_CLASS =
  'clickable clickableTint hitTarget chip self-start flex-row items-center justify-center gap-2';

export function ChipFace(props: {
  label: JSX.Element;
  startIcon?: JSX.Element;
}) {
  return (
    <>
      <Show when={props.startIcon !== undefined}>
        <div class="box h-4 items-center justify-center">{props.startIcon}</div>
      </Show>
      <span class="text textLabel line-clamp-1">{props.label}</span>
    </>
  );
}
