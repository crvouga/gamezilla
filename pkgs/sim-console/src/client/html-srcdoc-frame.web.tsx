/**
 * Web snapshot preview host (in-DOM). Native falls back to `html-srcdoc-frame.tsx`.
 *
 * Sandboxed `srcdoc` iframes stay blank in Cursor's embedded browser even when
 * `srcdoc` is set and the iframe has a non-zero box (Playwright paints the same
 * HTML). Mount the prepared snapshot body into a `.snapshot-host` instead.
 */
import { useLayoutEffect, useRef } from 'react';

import { HtmlPaneEmpty } from './html-pane-empty';

export function HtmlSrcdocFrame(props: {
  readonly title: string;
  /** Prepared in-DOM markup: scoped `<style>` tags + snapshot body. */
  readonly srcdoc: string | null;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const html = props.srcdoc;
    if (host == null || html == null || html.length === 0) return;
    host.innerHTML = html;
  }, [props.srcdoc]);

  if (props.srcdoc == null || props.srcdoc.length === 0) {
    return <HtmlPaneEmpty kind="blank" />;
  }

  return (
    <div
      ref={hostRef}
      className="snapshot-host"
      title={props.title}
      style={hostStyle}
    />
  );
}

const hostStyle = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: 'hsla(240, 5%, 4%, 1)',
} as const;
