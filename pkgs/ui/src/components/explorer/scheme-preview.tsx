/** @jsxImportSource solid-js */
/**
 * `SchemePreview` -- side-by-side preview of children in both color schemes.
 *
 * Colors are CSS variables scoped by the `data-theme` attribute
 * (generated token stylesheet), so each pane simply re-scopes the token set
 * for its subtree with `data-theme="light"` / `data-theme="dark"`. No nested
 * `ThemeProvider` is mounted — that would also flip the document-level scheme.
 *
 * Note: `palette()` / `colorScheme()` readers inside the panes still see the
 * ambient theme; only CSS-variable-driven styling follows the pane scheme.
 *
 * Panes stack vertically for mobile-first readability.
 */

import type { JSX } from 'solid-js';
import type { ColorScheme } from '../../theme';

export type SchemePreviewProps = {
  children: JSX.Element;
};

export function SchemePreview(props: SchemePreviewProps): JSX.Element {
  return (
    <div class="box flex-col gap-4" data-component="SchemePreview">
      <SchemePane label="Light" scheme="light">
        {props.children}
      </SchemePane>
      <SchemePane label="Dark" scheme="dark">
        {props.children}
      </SchemePane>
    </div>
  );
}

function SchemePane(props: {
  label: string;
  scheme: ColorScheme;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box flex-1 p-4 gap-3 bg-background border border-solid border-border rounded-[14px] text-text"
      data-component="SchemePane"
      data-scheme={props.scheme}
      data-theme={props.scheme}
    >
      <p class="text textCaption text-text-secondary">
        {props.label.toUpperCase()}
      </p>
      {props.children}
    </div>
  );
}
