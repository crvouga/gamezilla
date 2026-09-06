import {
  Box,
  EmptyState,
  ErrorState,
  LoadingState,
  MonitorIcon,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { paneSx } from './tokens';

const emptyPaneSx = {
  ...paneSx,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** Centered empty / error / loading chrome for HTML snapshot panes. */
export function HtmlPaneEmpty(props: {
  readonly kind: 'missing' | 'blank' | 'error' | 'loading' | 'unsupported';
  readonly nodeId?: string | null;
  readonly detail?: string;
}): ReactNode {
  const node = props.nodeId?.trim() ? props.nodeId : 'this client';
  return (
    <Box sx={emptyPaneSx}>
      <HtmlPaneEmptyBody
        kind={props.kind}
        node={node}
        {...(props.detail !== undefined ? { detail: props.detail } : {})}
      />
    </Box>
  );
}

function HtmlPaneEmptyBody(props: {
  readonly kind: 'missing' | 'blank' | 'error' | 'loading' | 'unsupported';
  readonly node: string;
  readonly detail?: string;
}): ReactNode {
  switch (props.kind) {
    case 'loading':
      return <LoadingState caption="Loading snapshot…" />;
    case 'error':
      return (
        <ErrorState
          title="Couldn't load snapshot"
          body={props.detail ?? 'Try scrubbing to another step.'}
        />
      );
    case 'blank':
      return (
        <EmptyState
          icon={MonitorIcon}
          title="Empty snapshot"
          body={`The capture for ${props.node} has no visible UI on this step.`}
        />
      );
    case 'unsupported':
      return (
        <EmptyState
          icon={MonitorIcon}
          title="Preview unavailable"
          body="HTML snapshot preview requires web."
        />
      );
    case 'missing':
      return (
        <EmptyState
          icon={MonitorIcon}
          title="No snapshot"
          body={`${props.node} wasn't on screen for this step — scrub to when they acted.`}
        />
      );
  }
}
