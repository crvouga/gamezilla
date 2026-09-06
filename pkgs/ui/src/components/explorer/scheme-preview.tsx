/** @jsxImportSource solid-js */
/**
 * `SchemePreview` -- side-by-side preview of children in both color schemes.
 *
 * Colors are CSS variables scoped by the `data-theme` attribute
 * (`tokens.css`), so each pane simply re-scopes the token set for its subtree
 * with `data-theme="light"` / `data-theme="dark"`. No nested `ThemeProvider`
 * is mounted — that would also flip the document-level scheme.
 *
 * Note: `palette()` / `colorScheme()` readers inside the panes still see the
 * ambient theme; only CSS-variable-driven styling follows the pane scheme.
 *
 * Panes stack vertically for mobile-first readability.
 */

import type { JSX } from 'solid-js';
import type { ColorScheme } from '../../theme';
import { Box } from '../box';
import { Text } from '../text';

export type SchemePreviewProps = {
  children: JSX.Element;
};

export function SchemePreview(props: SchemePreviewProps): JSX.Element {
  return (
    <Box
      sx={{ flexDirection: 'column', gap: 4 }}
      dataSet={{ component: 'SchemePreview' }}
    >
      <SchemePane label="Light" scheme="light">
        {props.children}
      </SchemePane>
      <SchemePane label="Dark" scheme="dark">
        {props.children}
      </SchemePane>
    </Box>
  );
}

function SchemePane(props: {
  label: string;
  scheme: ColorScheme;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Box
      data-theme={props.scheme}
      dataSet={{ component: 'SchemePane', scheme: props.scheme }}
      sx={{
        flex: 1,
        p: 4,
        gap: 3,
        background: 'background',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        borderRadius: 'lg',
        color: 'text',
      }}
    >
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={props.label.toUpperCase()}
      />
      {props.children}
    </Box>
  );
}
