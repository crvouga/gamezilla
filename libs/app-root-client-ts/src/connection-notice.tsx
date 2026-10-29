/** @jsxImportSource solid-js */
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { ServerIcon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { StatusIconSlot } from '@pkgs/ui-root-client-ts/status-icon-slot';
import { type JSX, Show } from 'solid-js';
import type { ConnectionCause } from './connection-cause';
import {
  createConnectionCause,
  useConnectionNoticeLabel,
} from './connection-copy';

/** A reserved header slot keeps content still as connectivity changes. */
export function ConnectionNotice(): JSX.Element {
  const cause = createConnectionCause();
  return <ConnectionStatusIndicator cause={cause()} />;
}

/**
 * Says which part is missing: the person's own choice or device ("You're
 * offline") versus the product being out of reach, which is not their doing.
 */
export function ConnectionStatusIndicator(props: {
  readonly cause: ConnectionCause;
}): JSX.Element {
  const label = useConnectionNoticeLabel();
  const unreachable = (): boolean =>
    props.cause === 'unreachable' || props.cause === 'checking';
  /** Follows the cause while shown, so the slot itself never remounts. */
  const CauseIcon: IconComponent = (iconProps) => (
    <Show when={unreachable()} fallback={<WifiOffIcon {...iconProps} />}>
      <ServerIcon {...iconProps} />
    </Show>
  );
  return (
    <StatusIconSlot
      shown={props.cause !== 'connected'}
      icon={CauseIcon}
      label={label(props.cause)}
      testId={Handles.statusConnectionMissing}
    />
  );
}
