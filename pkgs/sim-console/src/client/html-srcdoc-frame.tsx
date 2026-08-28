import type { ReactNode } from 'react';

import { HtmlPaneEmpty } from './html-pane-empty';

/** Native fallback — iframe srcdoc preview is web-only. */
export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}): ReactNode {
  void props;
  return <HtmlPaneEmpty kind="unsupported" />;
}
