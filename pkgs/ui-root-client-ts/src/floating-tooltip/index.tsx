/** @jsxImportSource solid-js */
import { createEffect, createSignal, type JSX, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useThemeTokens } from '../theme-context/index';
import type { TooltipPlacement } from '../tooltip/index';
import styles from '../tooltip/tooltip.module.css';

/**
 * Theme-aware portal bubble anchored to a host element. Tooltip owns visibility and accessible association; position follows scrolling and resizing and listeners are cleaned up on disposal.
 */
export function FloatingTooltip(props: {
  anchor: () => HTMLElement | undefined;
  visible: () => boolean;
  placement: () => TooltipPlacement;
  children: JSX.Element;
}) {
  const theme = useThemeTokens();
  const [position, setPosition] = createSignal<JSX.CSSProperties>({});
  let bubble: HTMLDivElement | undefined;
  createEffect(() => {
    if (!props.visible()) return;
    const update = () => {
      const rect = props.anchor()?.getBoundingClientRect();
      if (!rect || !bubble) return;
      const size = bubble.getBoundingClientRect();
      const placement = props.placement();
      const above = placement.startsWith('top');
      let left = rect.left + (rect.width - size.width) / 2;
      if (placement.endsWith('-start')) left = rect.left;
      if (placement.endsWith('-end')) left = rect.right - size.width;
      const top = above ? rect.top - size.height - 6 : rect.bottom + 6;
      setPosition({
        left: `${Math.max(8, Math.min(left, window.innerWidth - size.width - 8))}px`,
        top: `${Math.max(8, Math.min(top, window.innerHeight - size.height - 8))}px`,
      });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    onCleanup(() => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    });
  });
  return (
    <Portal>
      <div
        ref={bubble}
        class="box fixed pointer-events-none w-max max-w-full"
        classList={{ [styles['floating-layer'] ?? '']: true }}
        style={position()}
        data-component="FloatingTooltip"
        data-theme={theme.colorScheme()}
      >
        {props.children}
      </div>
    </Portal>
  );
}
