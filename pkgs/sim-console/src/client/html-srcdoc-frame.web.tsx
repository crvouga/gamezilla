/**
 * Web iframe srcdoc host. Native falls back to `html-srcdoc-frame.tsx`.
 */
import { Box, Text } from '@pkgs/ui';

import { emptySx, paneSx } from './tokens';

const PREVIEW_IFRAME_CLASS = 'system-console-html-preview';

const PREVIEW_IFRAME_CSS = `
.${PREVIEW_IFRAME_CLASS} {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
  background: hsla(240, 5%, 4%, 1);
}
`;

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
    <Box sx={paneSx}>
      <style>{PREVIEW_IFRAME_CSS}</style>
      <iframe
        className={PREVIEW_IFRAME_CLASS}
        title={props.title}
        srcDoc={props.srcdoc}
        sandbox=""
      />
    </Box>
  );
}
