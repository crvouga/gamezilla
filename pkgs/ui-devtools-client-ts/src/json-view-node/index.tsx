/** @jsxImportSource @solidjs/web */
/**
 * Recursive renderer for one node in the {@link JsonView} tree.
 *
 * The node is responsible for:
 * - Drawing its own header row (chevron + key + type-colored value/summary)
 * - Recursing into children when expanded
 */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
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
  formatPathLabel,
  isContainer,
  stringifyForCopy,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import { ChevronRightIcon, CopyIcon } from '@pkgs/ui-root-client-ts/icons';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import type { JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
import { TreeGroup, TreeItem, TreeItemLabel } from '@ui-sdk/solid/tree';
import { createMemo, For, Show } from 'solid-js';
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
  /** Per-row copy sink; rows hide their copy button when undefined. */
  copy: JsonViewCopy | undefined;
};

export function treeItemValue(path: JsonPath): string {
  return encodeURI(formatPathLabel(path));
}

export function JsonViewNode(props: JsonViewNodeProps): JSX.Element {
  const kind = createMemo(() => classifyValue(props.value));
  const expandable = () => isContainer(kind());
  const label = () =>
    expandable()
      ? formatPathLabel(props.path)
      : `${formatPathLabel(props.path)} = ${formatLeafPreview(props.value, kind())}`;
  return (
    <TreeItem
      class="box"
      value={treeItemValue(props.path)}
      branch={expandable()}
      label={label()}
      aria-label={label()}
    >
      {(state) => (
        <>
          <NodeRow
            nodeKey={props.nodeKey}
            value={props.value}
            kind={kind()}
            depth={props.depth}
            expandable={expandable()}
            expanded={state.expanded}
            copy={props.copy}
          />
          <Show when={state.expanded && expandable()}>
            <TreeGroup class="box">
              <NodeChildren
                value={props.value}
                kind={kind()}
                path={props.path}
                depth={props.depth}
                copy={props.copy}
              />
            </TreeGroup>
          </Show>
        </>
      )}
    </TreeItem>
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
          <TreeItemLabel class="box" style={rowStyle(props.depth)}>
            {content()}
          </TreeItemLabel>
        }
      >
        <TreeItemLabel
          render={(attrs) => <button {...attrs} type="button" tabindex="-1" />}
          class="clickable text-left"
          style={rowStyle(props.depth)}
          aria-expanded={props.expanded ? 'true' : 'false'}
        >
          {content()}
        </TreeItemLabel>
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
  copy: JsonViewCopy | undefined;
}): JSX.Element {
  const entries = createMemo(() => entriesOf(props.value, props.kind));
  return (
    <>
      <For each={entries()}>
        {([childKey, childValue]) => (
          <JsonViewNode
            nodeKey={childKey}
            value={childValue}
            path={[...props.path, childKey]}
            depth={props.depth + 1}
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
    </>
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
    <SdkButton
      class="clickable clickableOpacity w-5 h-5 items-center justify-center opacity-muted shrink-0"
      type="button"
      aria-label={t`Copy value`}
      onClick={() => {
        void props.copy(stringifyForCopy(props.value));
      }}
    >
      <CopyIcon size={12} />
    </SdkButton>
  );
}
