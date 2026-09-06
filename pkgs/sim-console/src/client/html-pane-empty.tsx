import {
  Box,
  EmptyState,
  ErrorState,
  LoadingState,
  MonitorIcon,
} from '@pkgs/ui';
import { Match, Switch } from 'solid-js';
import { paneSx } from './tokens';

/** Centered empty / error / loading chrome for snapshot panes. */
export function HtmlPaneEmpty(props: {
  readonly kind: 'missing' | 'blank' | 'error' | 'loading';
  readonly nodeId?: string | null;
  readonly detail?: string;
}) {
  const node = () => (props.nodeId?.trim() ? props.nodeId : 'this client');
  return (
    <Box sx={{ ...paneSx, alignItems: 'center', justifyContent: 'center' }}>
      <Switch>
        <Match when={props.kind === 'loading'}>
          <LoadingState caption="Loading snapshot..." />
        </Match>
        <Match when={props.kind === 'error'}>
          <ErrorState
            title="Couldn't load snapshot"
            body={props.detail ?? 'Try scrubbing to another step.'}
          />
        </Match>
        <Match when={props.kind === 'blank'}>
          <EmptyState
            icon={MonitorIcon}
            title="Empty snapshot"
            body={`The capture for ${node()} has no visible UI on this step.`}
          />
        </Match>
        <Match when={props.kind === 'missing'}>
          <EmptyState
            icon={MonitorIcon}
            title="No snapshot"
            body={`${node()} wasn't on screen for this step. Scrub to when they acted.`}
          />
        </Match>
      </Switch>
    </Box>
  );
}
