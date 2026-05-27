/**
 * `JsonView` — collapsible JSON tree explorer.
 *
 * Renders any JavaScript value as an inspectable tree with type-aware
 * coloring, per-node expand/collapse, copy-to-clipboard, and a toolbar with
 * "expand all", "collapse all", and "copy". Designed for debug surfaces where
 * the developer wants to drill into a payload without leaving the app.
 *
 * @example
 * ```tsx
 * <JsonView value={someEntity} initialExpandDepth={1} />
 * ```
 */

import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import type { SxProps } from '../../theme';
import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Box } from '../box';
import { ScrollView } from '../scroll-view';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import {
  classifyValue,
  collectAllContainerPaths,
  encodePath,
  isContainer,
  safeStringify,
  type JsonPath,
  type JsonValueKind,
} from './json-view-helpers';
import { JsonViewNode } from './json-view-node';

const ROOT_PATH: JsonPath = [];
const ROOT_KEY = encodePath(ROOT_PATH);

export type JsonViewProps = {
  /** Any JS value. Objects and arrays expand; everything else renders as a leaf. */
  value: unknown;
  /** Depth at which nodes are expanded by default. Defaults to 1. */
  initialExpandDepth?: number;
  /** Cap for "expand all" — protects against deeply nested or huge payloads. Defaults to 8. */
  expandAllMaxDepth?: number;
  /** Optional label rendered above the tree (e.g. `space.attributes`). */
  label?: ReactNode;
  /** Hide the toolbar (expand all / collapse all / copy). Defaults to false. */
  hideToolbar?: boolean;
  /** Hide per-row copy buttons. Defaults to false. */
  hideRowCopy?: boolean;
  /** Cap on inner scroll height (px). When omitted the tree grows naturally. */
  maxHeight?: number;
  /** Outer wrapper sx shorthand. */
  sx?: SxProps;
  /** Optional accessibility/test id. */
  testID?: string;
};

type Baseline = 'depth' | 'all' | 'none';

type ExpansionState = {
  baseline: Baseline;
  overrides: Record<string, boolean>;
};

const INITIAL_STATE: ExpansionState = { baseline: 'depth', overrides: {} };

function resolveExpanded(
  state: ExpansionState,
  path: JsonPath,
  initialDepth: number
): boolean {
  const key = encodePath(path);
  const override = state.overrides[key];
  if (override !== undefined) return override;
  if (state.baseline === 'all') return true;
  if (state.baseline === 'none') return false;
  return path.length < initialDepth;
}

function applyExpandAll(
  value: unknown,
  expandAllMaxDepth: number
): ExpansionState {
  const paths = collectAllContainerPaths(value, {
    maxDepth: expandAllMaxDepth,
  });
  const overrides: Record<string, boolean> = {};
  for (const p of paths) overrides[p] = true;
  return { baseline: 'all', overrides };
}

function applyCollapseAll(): ExpansionState {
  return { baseline: 'none', overrides: { [ROOT_KEY]: false } };
}

type ExpansionApi = {
  isExpanded: (path: JsonPath, kind: JsonValueKind) => boolean;
  toggle: (path: JsonPath) => void;
  expandAll: () => void;
  collapseAll: () => void;
  reset: () => void;
};

function useJsonExpansion(args: {
  value: unknown;
  initialExpandDepth: number;
  expandAllMaxDepth: number;
}): ExpansionApi {
  const { value, initialExpandDepth, expandAllMaxDepth } = args;
  const [state, setState] = useState<ExpansionState>(INITIAL_STATE);

  const isExpanded = useCallback(
    (path: JsonPath, _kind: JsonValueKind) => {
      void _kind;
      return resolveExpanded(state, path, initialExpandDepth);
    },
    [state, initialExpandDepth]
  );

  const toggle = useCallback(
    (path: JsonPath) => {
      setState((prev) => {
        const key = encodePath(path);
        const current = resolveExpanded(prev, path, initialExpandDepth);
        return {
          baseline: prev.baseline,
          overrides: { ...prev.overrides, [key]: !current },
        };
      });
    },
    [initialExpandDepth]
  );

  const expandAll = useCallback(
    () => setState(applyExpandAll(value, expandAllMaxDepth)),
    [value, expandAllMaxDepth]
  );
  const collapseAll = useCallback(() => setState(applyCollapseAll()), []);
  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { isExpanded, toggle, expandAll, collapseAll, reset };
}

function JsonViewLabel({ label }: { label: ReactNode }) {
  return (
    <Box
      sx={{
        paddingHorizontal: 3,
        paddingTop: 2,
        paddingBottom: 1,
        borderBottomWidth: 1,
        borderColor: 'border',
      }}
    >
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
    </Box>
  );
}

function JsonViewBody({
  value,
  hideRowCopy,
  maxHeight,
  isExpanded,
  toggle,
}: {
  value: unknown;
  hideRowCopy: boolean;
  maxHeight: number | undefined;
  isExpanded: ExpansionApi['isExpanded'];
  toggle: ExpansionApi['toggle'];
}) {
  const theme = useTheme();
  const outerStyle =
    maxHeight !== undefined
      ? { maxHeight, backgroundColor: theme.colors.surface }
      : { backgroundColor: theme.colors.surface };
  const innerStyle = maxHeight !== undefined ? { maxHeight } : undefined;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={outerStyle}>
      <ScrollView
        showsVerticalScrollIndicator
        style={innerStyle}
        sx={{ paddingVertical: 2, paddingHorizontal: 3 }}
      >
        <JsonViewNode
          nodeKey={null}
          value={value}
          path={ROOT_PATH}
          depth={0}
          isExpanded={isExpanded}
          onToggle={toggle}
          showCopyButtons={!hideRowCopy}
        />
      </ScrollView>
    </ScrollView>
  );
}

export function JsonView({
  value,
  initialExpandDepth = 1,
  expandAllMaxDepth = 8,
  label,
  hideToolbar = false,
  hideRowCopy = false,
  maxHeight,
  sx,
  testID,
}: JsonViewProps) {
  const exp = useJsonExpansion({
    value,
    initialExpandDepth,
    expandAllMaxDepth,
  });
  const copyAll = useCallback(() => {
    void Clipboard.setStringAsync(safeStringify(value));
  }, [value]);
  const rootIsContainer = useMemo(
    () => isContainer(classifyValue(value)),
    [value]
  );

  return (
    <Box
      testID={testID}
      sx={{
        background: 'surfaceMuted',
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: borderRadius.md,
        ...sx,
      }}
    >
      {label !== undefined ? <JsonViewLabel label={label} /> : null}
      {!hideToolbar ? (
        <JsonViewToolbar
          rootIsContainer={rootIsContainer}
          onExpandAll={exp.expandAll}
          onCollapseAll={exp.collapseAll}
          onReset={exp.reset}
          onCopy={copyAll}
        />
      ) : null}
      <JsonViewBody
        value={value}
        hideRowCopy={hideRowCopy}
        maxHeight={maxHeight}
        isExpanded={exp.isExpanded}
        toggle={exp.toggle}
      />
    </Box>
  );
}

function JsonViewToolbar({
  rootIsContainer,
  onExpandAll,
  onCollapseAll,
  onReset,
  onCopy,
}: {
  rootIsContainer: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReset: () => void;
  onCopy: () => void;
}) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        paddingHorizontal: 2,
        paddingVertical: 1,
        borderBottomWidth: 1,
        borderColor: 'border',
        flexWrap: 'wrap',
      }}
    >
      <ToolbarButton
        label="Expand all"
        icon="chevron.right"
        iconRotateDeg={90}
        onPress={onExpandAll}
        disabled={!rootIsContainer}
      />
      <ToolbarButton
        label="Collapse all"
        icon="chevron.right"
        onPress={onCollapseAll}
        disabled={!rootIsContainer}
      />
      <ToolbarButton
        label="Reset"
        onPress={onReset}
        disabled={!rootIsContainer}
      />
      <Box style={{ flex: 1 }} />
      <ToolbarButton label="Copy" icon="copy" onPress={onCopy} />
    </Box>
  );
}

function ToolbarButton({
  label,
  icon,
  iconRotateDeg,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: 'chevron.right' | 'copy';
  iconRotateDeg?: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {icon ? (
        <Box
          style={{
            transform:
              iconRotateDeg !== undefined
                ? [{ rotate: `${iconRotateDeg}deg` }]
                : undefined,
          }}
        >
          <IconSymbol name={icon} size={10} color={theme.colors.icon} />
        </Box>
      ) : null}
      <Text variant="caption" sx={{ color: 'tint' }} label={label} />
    </Pressable>
  );
}
