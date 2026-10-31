/** @jsxImportSource solid-js */

import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { ColorScheme } from '@pkgs/ui-root-shared-ts/colors-types';
import type { JSX } from 'solid-js';

export type SchemePreviewProps = {
  children: JSX.Element;
};

/**
 * `SchemePreview` -- side-by-side preview of children in both color schemes.
 *
 * Colors are CSS variables scoped by the `data-theme` attribute
 * (generated token stylesheet), so each pane simply re-scopes the token set
 * for its subtree with `data-theme="light"` / `data-theme="dark"`.
 *
 * Each pane uses the production provider so CSS variables and JavaScript
 * palette consumers agree. Nested providers never own the document theme.
 *
 * Panes stack vertically for mobile-first readability.
 */
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
    <ThemeProvider
      colorScheme={props.scheme}
      manageDocumentTheme={false}
      reducedMotion
    >
      <div
        class="box flex-1 p-4 gap-3 bg-background border border-solid border-border rounded-card text-text"
        data-component="SchemePane"
        data-scheme={props.scheme}
        data-theme={props.scheme}
      >
        <p class="text textFootnote text-text-secondary">{props.label}</p>
        {props.children}
      </div>
    </ThemeProvider>
  );
}
