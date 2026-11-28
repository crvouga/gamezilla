/** @jsxImportSource @solidjs/web */
import { type JSX, Portal } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';
import type { TooltipPlacement } from '../tooltip/index';
import styles from '../tooltip/tooltip.module.css';

/**
 * Portal bubble anchored to a host element. Tooltip owns visibility and accessible association; position follows scrolling and resizing and listeners are cleaned up on disposal.
 */
export function FloatingTooltip(props: {
  anchor: () => HTMLElement | undefined;
  visible: () => boolean;
  placement: () => TooltipPlacement;
  children: JSX.Element;
}) {
  const [position, setPosition] = createSignal<JSX.CSSProperties>({});
  let bubble: HTMLDivElement | undefined;
  const shown = () =>
    props.visible()
      ? { anchor: props.anchor(), placement: props.placement() }
      : undefined;
  createEffect(shown, (tip) => {
    if (tip === undefined) return undefined;
    const { anchor, placement } = tip;
    const update = () => {
      const rect = anchor?.getBoundingClientRect();
      if (!rect || !bubble) return;
      const size = bubble.getBoundingClientRect();
      const above = placement.startsWith('top');
      let left = rect.left + (rect.width - size.width) / 2;
      if (placement.endsWith('-start')) left = rect.left;
      if (placement.endsWith('-end')) left = rect.right - size.width;
      let top = above ? rect.top - size.height - 6 : rect.bottom + 6;
      if (placement === 'left') {
        left = rect.left - size.width - 8;
        top = rect.top + (rect.height - size.height) / 2;
      }
      setPosition({
        left: `${Math.max(8, Math.min(left, window.innerWidth - size.width - 8))}px`,
        top: `${Math.max(8, Math.min(top, window.innerHeight - size.height - 8))}px`,
      });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  });
  return (
    <Portal>
      <div
        ref={bubble}
        class={[
          'box fixed pointer-events-none w-max max-w-full',
          { [styles['floating-layer'] ?? '']: true },
        ]}
        style={position()}
        data-component="FloatingTooltip"
      >
        {props.children}
      </div>
    </Portal>
  );
}
