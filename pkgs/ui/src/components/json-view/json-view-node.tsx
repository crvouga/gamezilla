/** @jsxImportSource solid-js */
/**
 * Recursive renderer for one node in the {@link JsonView} tree.
 *
 * The node is responsible for:
 * - Drawing its own header row (chevron + key + type-colored value/summary)
 * - Toggling its expanded state via the parent-supplied callback
 * - Recursing into children when expanded
 */

import { useLingui } from '@lingui/solid/macro';
import { createMemo, For, type JSX, Show } from 'solid-js';

import type { ColorTokenName } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronRightIcon, CopyIcon } from '../icons';
import { Text } from '../text';
import styles from './json-view.module.css';
import {
  classifyValue,
  containerBrackets,
  containerCount,
  entriesOf,
  formatContainerSummary,
  formatLeafPreview,
  isContainer,
  type JsonPath,
  type JsonValueKind,
  stringifyForCopy,
} from './json-view-logic';

const INDENT_PX = 14;
const ROW_PAD_Y = 2;

const VALUE_COLORS: Record<JsonValueKind, ColorTokenName> = {
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

/** Injected clipboard sink (never a bare `navigator.clipboard`). */
export type JsonViewCopy = (text: string) => Promise<void>;

export type JsonViewNodeProps = {
  /** Property key relative to the parent. `null` only for the synthetic root. */
  nodeKey: string | number | null;
  value: unknown;
  path: JsonPath;
  depth: number;
  isExpanded: (path: JsonPath) => boolean;
  onToggle: (path: JsonPath) => void;
  /** Per-row copy sink; rows hide their copy button when undefined. */
  copy: JsonViewCopy | undefined;
};

export function JsonViewNode(props: JsonViewNodeProps): JSX.Element {
  const kind = createMemo(() => classifyValue(props.value));
  const expandable = () => isContainer(kind());
  const expanded = () => expandable() && props.isExpanded(props.path);
  return (
    <Box role="treeitem" aria-expanded={expandable() ? expanded() : undefined}>
      <NodeRow
        nodeKey={props.nodeKey}
        value={props.value}
        kind={kind()}
        depth={props.depth}
        expandable={expandable()}
        expanded={expanded()}
        onToggle={() => {
          if (expandable()) props.onToggle(props.path);
        }}
        copy={props.copy}
      />
      <Show when={expanded()}>
        <NodeChildren
          value={props.value}
          kind={kind()}
          path={props.path}
          depth={props.depth}
          isExpanded={props.isExpanded}
          onToggle={props.onToggle}
          copy={props.copy}
        />
      </Show>
    </Box>
  );
}

function NodeRow(props: {
  nodeKey: string | number | null;
  value: unknown;
  kind: JsonValueKind;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  copy: JsonViewCopy | undefined;
}): JSX.Element {
  const rowSx = () => ({
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: ROW_PAD_Y,
    paddingLeft: props.depth * INDENT_PX,
    gap: 1,
    flexGrow: 1,
    minWidth: 0,
  });
  const content = () => (
    <>
      <Chevron expandable={props.expandable} expanded={props.expanded} />
      <KeyLabel nodeKey={props.nodeKey} />
      <ValueOrSummary
        value={props.value}
        kind={props.kind}
        expanded={props.expanded}
        expandable={props.expandable}
      />
    </>
  );
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Show
        when={props.expandable}
        fallback={<Box sx={rowSx()}>{content()}</Box>}
      >
        <Clickable
          onClick={() => props.onToggle()}
          aria-expanded={props.expanded}
          feedback="none"
          sx={[rowSx(), { textAlign: 'left' }]}
        >
          {content()}
        </Clickable>
      </Show>
      <Show when={props.copy}>
        {(copy) => <CopyValueButton value={props.value} copy={copy()} />}
      </Show>
    </Box>
  );
}

function NodeChildren(props: {
  value: unknown;
  kind: JsonValueKind;
  path: JsonPath;
  depth: number;
  isExpanded: (path: JsonPath) => boolean;
  onToggle: (path: JsonPath) => void;
  copy: JsonViewCopy | undefined;
}): JSX.Element {
  const entries = createMemo(() => entriesOf(props.value, props.kind));
  return (
    <Box role="group">
      <For each={entries()}>
        {([childKey, childValue]) => (
          <JsonViewNode
            nodeKey={childKey}
            value={childValue}
            path={[...props.path, childKey]}
            depth={props.depth + 1}
            isExpanded={props.isExpanded}
            onToggle={props.onToggle}
            copy={props.copy}
          />
        )}
      </For>
      <Box
        sx={{
          paddingLeft: (props.depth + 1) * INDENT_PX,
          paddingVertical: ROW_PAD_Y,
        }}
      >
        <Text
          variant="mono"
          sx={{ color: 'textSecondary' }}
          label={containerBrackets(props.kind).close}
        />
      </Box>
    </Box>
  );
}

function Chevron(props: {
  expandable: boolean;
  expanded: boolean;
}): JSX.Element {
  return (
    <Show when={props.expandable} fallback={<Box sx={{ width: 14 }} />}>
      <Box
        class={styles['chevron']}
        data-expanded={props.expanded ? 'true' : 'false'}
        sx={{
          width: 14,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronRightIcon size={10} />
      </Box>
    </Show>
  );
}

function KeyLabel(props: { nodeKey: string | number | null }): JSX.Element {
  const label = () => {
    const key = props.nodeKey;
    if (key === null) return '';
    return typeof key === 'number'
      ? `${key.toString()}: `
      : `${JSON.stringify(key)}: `;
  };
  return (
    <Show when={props.nodeKey !== null}>
      <Text variant="mono" sx={{ color: 'text' }} label={label()} />
    </Show>
  );
}

function ValueOrSummary(props: {
  value: unknown;
  kind: JsonValueKind;
  expanded: boolean;
  expandable: boolean;
}): JSX.Element {
  const brackets = () => containerBrackets(props.kind);
  return (
    <Show
      when={props.expandable}
      fallback={
        <Text
          variant="mono"
          sx={{ color: VALUE_COLORS[props.kind], flex: 1, minWidth: 0 }}
          label={formatLeafPreview(props.value, props.kind)}
        />
      }
    >
      <Show
        when={props.expanded}
        fallback={
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
              label={`${brackets().open}${brackets().close}`}
            />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={formatContainerSummary(
                containerCount(props.value, props.kind),
                props.kind
              )}
            />
          </Box>
        }
      >
        <Text
          variant="mono"
          sx={{ color: 'textSecondary', flex: 1 }}
          label={brackets().open}
        />
      </Show>
    </Show>
  );
}

function CopyValueButton(props: {
  value: unknown;
  copy: JsonViewCopy;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Clickable
      aria-label={t`Copy value`}
      onClick={() => {
        void props.copy(stringifyForCopy(props.value));
      }}
      feedback="opacity"
      sx={{
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.55,
        flexShrink: 0,
      }}
    >
      <CopyIcon size={12} />
    </Clickable>
  );
}
