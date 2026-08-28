import { Box, TabStrip, type TabStripItem } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { DebuggerViewId } from '../../shared/debugger-views';
import { coerceSimChromeKind, type SimChromeKind } from '../../shared/sim-node';
import {
  DEBUGGER_KIND_TABS,
  debuggerInstanceTabItem,
  debuggerViewTabItem,
} from '../debugger-chrome';
import type { FlatFrame } from '../frames';
import { PlayerStrip } from '../player-strip';
import {
  showDebuggerInstanceTabs,
  useSimConsoleLayout,
} from './use-sim-console-layout';

export type DebuggerInstance = {
  readonly id: string;
  readonly kind: string;
};

export type DebuggerShellProps = {
  readonly header?: ReactNode;
  /** Kind-strip trailing chrome (e.g. playground snapshot controls). */
  readonly kindTrailing?: ReactNode;
  /**
   * Kind tabs. Default: client/server/events/room. Pass `[]` (or one item)
   * to hide the strip — trailing chrome still renders.
   */
  readonly kindTabs?: readonly TabStripItem[];
  /** When false, hide the frame player (playground). Default true. */
  readonly showPlayer?: boolean;
  /** Fires on pointer-down on player / tab chrome (not the pane body). */
  readonly onChromePointerDown?: () => void;
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
    kindTabs = DEBUGGER_KIND_TABS,
    showPlayer = true,
    onChromePointerDown,
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
  const { compactChrome, multiClientColumns } = useSimConsoleLayout();
  const showKindStrip = kindTabs.length > 1;
  const showInstances = showDebuggerInstanceTabs({
    kind,
    instanceCount: instances.length,
    multiClientColumns,
  });
  const showViewStrip = views.length > 1;
  const trailingInStrip = !compactChrome ? kindTrailing : undefined;
  const trailingAsRow = compactChrome ? kindTrailing : undefined;

  return (
    <Box sx={shellSx}>
      {header}
      <Box onPointerDown={onChromePointerDown}>
        {showPlayer ? (
          <PlayerStrip
            frames={frames}
            selectedIndex={Math.max(0, selectedFrameIndex)}
            onSelect={onSelectFrame}
          />
        ) : null}
        {trailingAsRow !== undefined ? (
          <Box sx={trailingOnlySx}>{trailingAsRow}</Box>
        ) : null}
        <KindChrome
          showStrip={showKindStrip}
          kindTabs={kindTabs}
          kind={kind}
          onKindChange={onKindChange}
          kindTrailing={trailingInStrip}
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
        {showViewStrip ? (
          <TabStrip
            accessibilityLabel="Views"
            items={views.map((v) => debuggerViewTabItem(v))}
            selectedId={view}
            onSelect={(id) => onViewChange(id as DebuggerViewId)}
          />
        ) : null}
      </Box>
      <Box sx={paneSx}>{children}</Box>
    </Box>
  );
}

function KindChrome(props: {
  readonly showStrip: boolean;
  readonly kindTabs: readonly TabStripItem[];
  readonly kind: SimChromeKind;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly kindTrailing: ReactNode;
}): ReactNode {
  const { showStrip, kindTabs, kind, onKindChange, kindTrailing } = props;
  if (showStrip) {
    return (
      <TabStrip
        accessibilityLabel="Node kinds"
        items={[...kindTabs]}
        selectedId={kind}
        onSelect={(id) => onKindChange(coerceSimChromeKind(id))}
        keyboardScope
        {...(kindTrailing !== undefined ? { trailing: kindTrailing } : {})}
      />
    );
  }
  if (kindTrailing === undefined) return null;
  return <Box sx={trailingOnlySx}>{kindTrailing}</Box>;
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

const trailingOnlySx = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 2,
  paddingBottom: 2,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surfaceMuted',
  minWidth: 0,
} as const;
