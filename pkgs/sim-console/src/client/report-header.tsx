import type { JSX } from 'solid-js';

import { useSimConsoleLayout } from './debugger/use-sim-console-layout';
import {
  appHeaderMiddleSx,
  appHeaderSx,
  appHeaderTrailingSx,
  metaSx,
} from './tokens';

/** Shared top chrome for every simulation-report screen. */
export function ReportHeader(props: {
  readonly leading?: JSX.Element;
  readonly badge?: JSX.Element;
  readonly title?: JSX.Element;
  readonly meta?: JSX.Element;
  readonly end?: JSX.Element;
}) {
  const layout = useSimConsoleLayout();
  const showMeta = () =>
    !layout.compactChrome && props.meta != null && props.meta !== '';
  return (
    <div class="box" style={appHeaderSx}>
      {props.leading}
      {props.badge}
      <div class="box" style={appHeaderMiddleSx}>
        {props.title}
        {showMeta() ? (
          <p class="text line-clamp-1 shrink min-w-[0]" style={metaSx}>
            {props.meta}
          </p>
        ) : null}
      </div>
      {props.end != null ? (
        <div class="box shrink-0" style={appHeaderTrailingSx}>
          {props.end}
        </div>
      ) : null}
    </div>
  );
}
