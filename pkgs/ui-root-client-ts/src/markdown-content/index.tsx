/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { defaultMarkdownParser, schema } from 'prosemirror-markdown';
import { DOMSerializer } from 'prosemirror-model';
import { createEffect } from 'solid-js';
import styles from '../markdown-editor/markdown-editor.module.css';
import { cleanMarkdownNode } from '../safe-markdown';

/** Render the same Markdown document used by the editor without authored HTML. */
export function MarkdownContent(props: {
  value: string;
  dataSet?: ComponentDataSet;
}) {
  let host: HTMLDivElement | undefined;
  createEffect(() => {
    const doc = cleanMarkdownNode(defaultMarkdownParser.parse(props.value));
    host?.replaceChildren(
      DOMSerializer.fromSchema(schema).serializeFragment(doc.content)
    );
  });
  return (
    <div
      ref={host}
      class="text text-sm leading-relaxed break-words"
      classList={{ [styles['content'] ?? '']: true }}
      {...dataAttrs({ component: 'MarkdownContent', ...props.dataSet })}
    />
  );
}
