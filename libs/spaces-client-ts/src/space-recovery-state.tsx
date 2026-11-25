import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { H1 } from '@pkgs/ui-root-client-ts/heading';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  StateBlock,
  StateBlockIcon,
  type StateBlockTone,
} from '@pkgs/ui-root-client-ts/state-block';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { SpaceRecoveryBar } from './space-recovery-bar';

export type SpaceRecoveryStateProps = {
  /**
   * The state's glyph in its disc. Unset while the space is still
   * opening: a spinner, and no ways on yet.
   */
  readonly icon?: IconComponent | undefined;
  readonly tone?: StateBlockTone | undefined;
  /**
   * The screen's one heading: the page's last breadcrumb, which the
   * screen draws here (`titlePlacement="content"`), not in its header.
   */
  readonly title: JSX.Element;
  /** What happened and what to do, naming the space where it is known. */
  readonly body?: string | undefined;
  /** `alert` for a failure the person did not cause; `status` while opening. */
  readonly role?: 'alert' | 'status' | undefined;
  /** The block's `data-testid`, which the harness reads for the state. */
  readonly testId?: string | undefined;
  /** The ways on, side by side right under the message. */
  readonly children?: JSX.Element | undefined;
};

/**
 * A space screen that cannot go on (ended, unreachable, not found, not
 * allowed, offline, still opening), as one centred unit: the glyph, the
 * screen's title, why, and the ways on a step below. Title and message
 * share one axis on every width, so a wide window never leaves the title
 * on one edge and the message in the middle.
 */
export function SpaceRecoveryState(
  props: SpaceRecoveryStateProps
): JSX.Element {
  return (
    <StateBlock
      role={props.role}
      dataSet={{
        component: 'SpaceRecoveryState',
        ...(props.testId === undefined ? {} : { testid: props.testId }),
      }}
    >
      <Show when={props.icon} fallback={<Spinner size="lg" decorative />}>
        {(icon) => <StateBlockIcon icon={icon()} tone={props.tone} />}
      </Show>
      <H1 align="center">{props.title}</H1>
      <Show when={props.body}>
        <P variant="body" tone="secondary" align="center">
          {props.body}
        </P>
      </Show>
      <Show when={props.icon !== undefined}>
        <StackVertical width="full" paddingTop="md">
          <SpaceRecoveryBar>{props.children}</SpaceRecoveryBar>
        </StackVertical>
      </Show>
    </StateBlock>
  );
}
