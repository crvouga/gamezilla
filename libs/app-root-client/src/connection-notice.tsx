/** @jsxImportSource solid-js */
import { Handles } from '@libs/test-ids-shared/handles';
import { ServerIcon, WifiOffIcon } from '@pkgs/ui-root-client/icons';
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
 * offline") versus Gamezilla being out of reach, which is not their doing.
 */
export function ConnectionStatusIndicator(props: {
  readonly cause: ConnectionCause;
}): JSX.Element {
  const label = useConnectionNoticeLabel();
  const unreachable = (): boolean =>
    props.cause === 'unreachable' || props.cause === 'checking';
  return (
    <div
      class="box h-8 w-8 shrink-0 items-center justify-center"
      data-component="ConnectionStatus"
    >
      <Show when={props.cause !== 'connected'}>
        <span
          role="status"
          aria-live="polite"
          title={label(props.cause)}
          data-testid={Handles.statusConnectionMissing}
        >
          <Show
            when={unreachable()}
            fallback={<WifiOffIcon size={20} color="icon" />}
          >
            <ServerIcon size={20} color="icon" />
          </Show>
          <span class="sr-only">{label(props.cause)}</span>
        </span>
      </Show>
    </div>
  );
}
