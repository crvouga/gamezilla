import { Box, TabStrip } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { DebuggerViewId } from '../../shared/debugger-views';
import {
  coerceSimChromeKind,
  type SimChromeKind,
} from '../../shared/sim-node';
import {
  DEBUGGER_KIND_TABS,
  debuggerInstanceTabItem,
  debuggerViewTabItem,
} from '../debugger-chrome';
import type { FlatFrame } from '../frames';
import { PlayerStrip } from '../player-strip';

export type DebuggerInstance = {
  readonly id: string;
  readonly kind: string;
};

export type DebuggerShellProps = {
  readonly header?: ReactNode;
  /** Kind-strip trailing chrome (e.g. playground snapshot controls). */
  readonly kindTrailing?: ReactNode;
  /** When false, hide the frame player (playground). Default true. */
  readonly showPlayer?: boolean;
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIndex: number;
  readonly onSelectFrame: (index: number) => void;
  readonly kind: SimChromeKind;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly instances: readonly DebuggerInstance[];
  readonly instanceId: string | null;
  readonly onInstanceChange: (id: string) => void;
  readonly views: readonly DebuggerViewId[];
  readonly view: DebuggerViewId | null;
  readonly onViewChange: (view: DebuggerViewId) => void;
  readonly children: ReactNode;
};

export function DebuggerShell(props: DebuggerShellProps): ReactNode {
  const {
    header,
    kindTrailing,
    showPlayer = true,
    frames,
    selectedFrameIndex,
    onSelectFrame,
    kind,
    onKindChange,
    instances,
    instanceId,
    onInstanceChange,
    views,
    view,
    onViewChange,
    children,
  } = props;
  const showInstances = kind !== 'client' && instances.length > 1;

  return (
    <Box sx={shellSx}>
      {header}
      {showPlayer ? (
        <PlayerStrip
          frames={frames}
          selectedIndex={Math.max(0, selectedFrameIndex)}
          onSelect={onSelectFrame}
        />
      ) : null}
      <TabStrip
        accessibilityLabel="Node kinds"
        items={[...DEBUGGER_KIND_TABS]}
        selectedId={kind}
        onSelect={(id) => onKindChange(coerceSimChromeKind(id))}
        keyboardScope
        {...(kindTrailing !== undefined ? { trailing: kindTrailing } : {})}
      />
      {showInstances ? (
        <TabStrip
          accessibilityLabel="Node instances"
          items={instances.map((n) =>
            debuggerInstanceTabItem({ id: n.id, kind: n.kind })
          )}
          selectedId={instanceId}
          onSelect={onInstanceChange}
        />
      ) : null}
      <TabStrip
        accessibilityLabel="Views"
        items={views.map((v) => debuggerViewTabItem(v))}
        selectedId={view}
        onSelect={(id) => onViewChange(id as DebuggerViewId)}
      />
      <Box sx={paneSx}>{children}</Box>
    </Box>
  );
}

const shellSx = {
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
} as const;

const paneSx = {
  flex: 1,
  minHeight: 0,
  background: 'background',
} as const;
