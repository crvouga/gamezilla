/**
 * Recursive renderer for one node in the {@link JsonView} tree.
 *
 * The node is responsible for:
 * - Drawing its own header row (chevron + key + type-colored value/summary)
 * - Toggling its expanded state via the parent-supplied callback
 * - Recursing into children when expanded
 */

import * as Clipboard from 'expo-clipboard';
import { Pressable } from 'react-native';
import type { ColorTokens } from '../../theme';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { ChevronRightIcon, CopyIcon } from '../icons';
import { Text } from '../text';
import {
  classifyValue,
  containerBrackets,
  containerCount,
  encodePath,
  entriesOf,
  formatContainerSummary,
  formatLeafPreview,
  isContainer,
  safeStringify,
  type JsonPath,
  type JsonValueKind,
} from './json-view-helpers';

const INDENT_PX = 14;
const ROW_PAD_Y = 2;

const VALUE_COLORS: Record<JsonValueKind, keyof ColorTokens> = {
  string: 'success',
  number: 'info',
  bigint: 'info',
  boolean: 'warning',
  null: 'textSecondary',
  undefined: 'textSecondary',
  array: 'text',
  object: 'text',
  function: 'destructive',
  symbol: 'destructive',
  date: 'tint',
  error: 'destructive',
  circular: 'destructive',
  unknown: 'textSecondary',
};

export type JsonViewNodeProps = {
  /** Property key relative to the parent. `null` only for the synthetic root. */
  nodeKey: string | number | null;
  value: unknown;
  path: JsonPath;
  depth: number;
  isExpanded: (path: JsonPath, kind: JsonValueKind) => boolean;
  onToggle: (path: JsonPath) => void;
  /** Whether per-row copy buttons should be shown. */
  showCopyButtons: boolean;
};

export function JsonViewNode({
  nodeKey,
  value,
  path,
  depth,
  isExpanded,
  onToggle,
  showCopyButtons,
}: JsonViewNodeProps) {
  const kind = classifyValue(value);
  const expandable = isContainer(kind);
  const expanded = expandable && isExpanded(path, kind);

  return (
    <Box>
      <NodeRow
        nodeKey={nodeKey}
        value={value}
        kind={kind}
        depth={depth}
        expandable={expandable}
        expanded={expanded}
        onToggle={() => {
          if (expandable) onToggle(path);
        }}
        showCopyButtons={showCopyButtons}
      />
      {expandable && expanded ? (
        <NodeChildren
          value={value}
          kind={kind}
          path={path}
          depth={depth}
          isExpanded={isExpanded}
          onToggle={onToggle}
          showCopyButtons={showCopyButtons}
        />
      ) : null}
    </Box>
  );
}

function NodeRow({
  nodeKey,
  value,
  kind,
  depth,
  expandable,
  expanded,
  onToggle,
  showCopyButtons,
}: {
  nodeKey: string | number | null;
  value: unknown;
  kind: JsonValueKind;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  showCopyButtons: boolean;
}) {
  return (
    <Pressable
      onPress={expandable ? onToggle : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: ROW_PAD_Y,
        paddingLeft: depth * INDENT_PX,
        gap: 4,
      }}
    >
      <Chevron expandable={expandable} expanded={expanded} />
      <KeyLabel nodeKey={nodeKey} />
      <ValueOrSummary
        value={value}
        kind={kind}
        expanded={expanded}
        expandable={expandable}
      />
      {showCopyButtons ? <CopyValueButton value={value} /> : null}
    </Pressable>
  );
}

function NodeChildren({
  value,
  kind,
  path,
  depth,
  isExpanded,
  onToggle,
  showCopyButtons,
}: {
  value: unknown;
  kind: JsonValueKind;
  path: JsonPath;
  depth: number;
  isExpanded: (path: JsonPath, kind: JsonValueKind) => boolean;
  onToggle: (path: JsonPath) => void;
  showCopyButtons: boolean;
}) {
  const entries = entriesOf(value, kind);
  const { close } = containerBrackets(kind);
  return (
    <Box>
      {entries.map(([childKey, childValue]) => {
        const childPath: JsonPath = [...path, childKey];
        return (
          <JsonViewNode
            key={encodePath(childPath)}
            nodeKey={childKey}
            value={childValue}
            path={childPath}
            depth={depth + 1}
            isExpanded={isExpanded}
            onToggle={onToggle}
            showCopyButtons={showCopyButtons}
          />
        );
      })}
      <Box
        style={{
          paddingLeft: (depth + 1) * INDENT_PX,
          paddingVertical: ROW_PAD_Y,
        }}
      >
        <Text variant="mono" sx={{ color: 'textSecondary' }} label={close} />
      </Box>
    </Box>
  );
}

function Chevron({
  expandable,
  expanded,
}: {
  expandable: boolean;
  expanded: boolean;
}) {
  const theme = useTheme();
  if (!expandable) {
    return <Box style={{ width: 14 }} />;
  }
  return (
    <Box
      style={{
        width: 14,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: expanded ? '90deg' : '0deg' }],
      }}
    >
      <ChevronRightIcon size={10} color={theme.colors.icon} />
    </Box>
  );
}

function KeyLabel({ nodeKey }: { nodeKey: string | number | null }) {
  if (nodeKey === null) return null;
  const label =
    typeof nodeKey === 'number'
      ? `${nodeKey.toString()}: `
      : `${JSON.stringify(nodeKey)}: `;
  return <Text variant="mono" sx={{ color: 'text' }} label={label} />;
}

function ValueOrSummary({
  value,
  kind,
  expanded,
  expandable,
}: {
  value: unknown;
  kind: JsonValueKind;
  expanded: boolean;
  expandable: boolean;
}) {
  if (!expandable) {
    return (
      <Text
        variant="mono"
        selectable
        sx={{ color: VALUE_COLORS[kind], flex: 1, minWidth: 0 }}
        label={formatLeafPreview(value, kind)}
      />
    );
  }
  const { open, close } = containerBrackets(kind);
  const count = containerCount(value, kind);
  if (expanded) {
    return (
      <Text
        variant="mono"
        sx={{ color: 'textSecondary', flex: 1 }}
        label={open}
      />
    );
  }
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Text
        variant="mono"
        sx={{ color: 'textSecondary' }}
        label={`${open}${close}`}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={formatContainerSummary(count, kind)}
      />
    </Box>
  );
}

function CopyValueButton({ value }: { value: unknown }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => {
        const text = stringifyForCopy(value);
        void Clipboard.setStringAsync(text);
      }}
      style={({ pressed }) => ({
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 0.55,
      })}
    >
      <CopyIcon size={12} color={theme.colors.icon} />
    </Pressable>
  );
}

function stringifyForCopy(value: unknown): string {
  const kind = classifyValue(value);
  if (isContainer(kind)) return safeStringify(value);
  if (kind === 'string' && typeof value === 'string') return value;
  return formatLeafPreview(value, kind);
}
