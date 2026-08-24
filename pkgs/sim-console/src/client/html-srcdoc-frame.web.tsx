/**
 * Web iframe host for static report frame previews (`srcdoc` + strict sandbox).
 * Native falls back to `html-srcdoc-frame.tsx`.
 *
 * Do **not** add `allow-same-origin`: opaque origin keeps Expo/Metro HMR from
 * injecting the dev bundle into preview iframes (same-origin sandboxed frames
 * otherwise log "Blocked script execution … allow-scripts is not set").
 */
import { Box, Text } from '@pkgs/ui';

import { emptySx, paneSx } from './tokens';

/** Static HTML only — no scripts, no same-origin (see module doc). */
const PREVIEW_SANDBOX = '';

export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}) {
  if (props.srcdoc == null || props.srcdoc.length === 0) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>No HTML snapshot for this frame.</Text>
      </Box>
    );
  }

  return (
    <Box sx={shellSx}>
      <iframe
        title={props.title}
        sandbox={PREVIEW_SANDBOX}
        srcDoc={props.srcdoc}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
          background: 'hsla(240, 5%, 4%, 1)',
        }}
      />
    </Box>
  );
}

const shellSx = {
  ...paneSx,
  minWidth: 0,
  overflow: 'hidden',
  backgroundColor: 'hsla(240, 5%, 4%, 1)',
} as const;
