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
import type {
  JsonPath,
  JsonValueKind,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import {
  classifyValue,
  containerBrackets,
  containerCount,
  entriesOf,
  formatContainerSummary,
  formatLeafPreview,
  isContainer,
  stringifyForCopy,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import { ChevronRightIcon, CopyIcon } from '@pkgs/ui-root-client-ts/icons';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { createMemo, For, type JSX, Show } from 'solid-js';
import styles from '../json-view/json-view.module.css';

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
    <div
      class="box"
      role="treeitem"
      aria-selected="false"
      aria-expanded={expandable() ? expanded() : undefined}
    >
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
    </div>
  );
}

function rowStyle(depth: number): JSX.CSSProperties {
  return {
    'flex-direction': 'row',
    'align-items': 'flex-start',
    'padding-top': `${ROW_PAD_Y}px`,
    'padding-bottom': `${ROW_PAD_Y}px`,
    'padding-left': `${depth * INDENT_PX}px`,
    gap: '4px',
    'flex-grow': 1,
    'min-width': 0,
  };
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
    <div class="box flex-row items-start">
      <Show
        when={props.expandable}
        fallback={
          <div class="box" style={rowStyle(props.depth)}>
            {content()}
          </div>
        }
      >
        <button
          class="clickable text-left"
          type="button"
          style={rowStyle(props.depth)}
          onClick={() => props.onToggle()}
          aria-expanded={props.expanded}
        >
          {content()}
        </button>
      </Show>
      <Show when={props.copy}>
        {(copy) => <CopyValueButton value={props.value} copy={copy()} />}
      </Show>
    </div>
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
    <div class="box" role="group">
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
      <div
        class="box"
        style={{
          'padding-left': `${(props.depth + 1) * INDENT_PX}px`,
          'padding-top': `${ROW_PAD_Y}px`,
          'padding-bottom': `${ROW_PAD_Y}px`,
        }}
      >
        <code class="text textMono text-text-secondary">
          {containerBrackets(props.kind).close}
        </code>
      </div>
    </div>
  );
}

function Chevron(props: {
  expandable: boolean;
  expanded: boolean;
}): JSX.Element {
  return (
    <Show when={props.expandable} fallback={<div class="box w-4" />}>
      <div
        class={`box w-4 h-5 items-center justify-center ${styles['chevron'] ?? ''}`}
        data-expanded={props.expanded ? 'true' : 'false'}
      >
        <ChevronRightIcon size={10} />
      </div>
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
      <code class="text textMono text-text">{label()}</code>
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
        <code
          class="text textMono flex-1 min-w-0"
          style={{ color: colorVar(VALUE_COLORS[props.kind]) }}
        >
          {formatLeafPreview(props.value, props.kind)}
        </code>
      }
    >
      <Show
        when={props.expanded}
        fallback={
          <div class="box flex-row items-center flex-1 gap-2 flex-wrap">
            <code class="text textMono text-text-secondary">
              {`${brackets().open}${brackets().close}`}
            </code>
            <p class="text textCaption text-text-secondary">
              {formatContainerSummary(
                containerCount(props.value, props.kind),
                props.kind
              )}
            </p>
          </div>
        }
      >
        <code class="text textMono text-text-secondary flex-1">
          {brackets().open}
        </code>
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
    <button
      class="clickable clickableOpacity w-5 h-5 items-center justify-center opacity-muted shrink-0"
      type="button"
      aria-label={t`Copy value`}
      onClick={() => {
        void props.copy(stringifyForCopy(props.value));
      }}
    >
      <CopyIcon size={12} />
    </button>
  );
}
