import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { emptySx, paneSx } from './tokens';

/** Native fallback — iframe srcdoc preview is web-only. */
export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}): ReactNode {
  void props;
  return (
    <Box sx={paneSx}>
      <Text sx={emptySx}>HTML preview requires web.</Text>
    </Box>
  );
}
