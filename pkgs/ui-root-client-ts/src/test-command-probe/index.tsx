/** @jsxImportSource @solidjs/web */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Button } from '@ui-sdk/solid/button';
import { Input } from '@ui-sdk/solid/input';

export type TestCommandProbeProps = {
  /** Accessible name of the command field. */
  commandLabel: string;
  /** Text and accessible name of the send control. */
  sendLabel: string;
  /** The command typed so far. */
  command: string;
  onCommandInput: (value: string) => void;
  onSend: () => void;
  /** Serialized state the test reads back. */
  readout: string;
  /** Rendered as the command field's `data-testid`. */
  commandTestId?: string | undefined;
  /** Rendered as the send control's `data-testid`. */
  sendTestId?: string | undefined;
  /** Rendered as the readout's `data-testid`. */
  readoutTestId?: string | undefined;
};

/**
 * `TestCommandProbe` -- a hidden port that lets an automated test drive a
 * screen the way a modified device would: a command field, a send control,
 * and a readout of the state the screen rendered. It is visually hidden and
 * out of the tab order; nobody looking at the screen ever sees it.
 *
 * The screen decides when to mount it (behind its test-hooks flag); this
 * component only owns the markup, so product code never hand-rolls a raw
 * `<input>` / `<button>` / `<pre>` for a test hook.
 *
 * The send control is a native button, so Enter on it sends as a click
 * does: a driver that can only press keys reaches it too.
 *
 * @example
 * ```tsx
 * <Show when={TEST_HOOKS_ENABLED}>
 *   <TestCommandProbe
 *     commandLabel="Conformance command"
 *     sendLabel="Send command"
 *     command={request()}
 *     onCommandInput={setRequest}
 *     onSend={() => void send()}
 *     readout={JSON.stringify(state())}
 *     commandTestId="probe-command"
 *     sendTestId="probe-send"
 *     readoutTestId="probe-readout"
 *   />
 * </Show>
 * ```
 */
export function TestCommandProbe(props: TestCommandProbeProps): JSX.Element {
  return (
    <div
      data-agent-hidden=""
      class="sr-only"
      data-component={componentId('TestCommandProbe')}
    >
      <Input
        value={props.command}
        onValueChange={(value) => props.onCommandInput(value)}
        aria-label={props.commandLabel}
        tabindex={-1}
        data-testid={props.commandTestId}
      />
      <Button
        type="button"
        tabindex={-1}
        onClick={() => props.onSend()}
        data-testid={props.sendTestId}
      >
        {props.sendLabel}
      </Button>
      <pre data-testid={props.readoutTestId}>{props.readout}</pre>
    </div>
  );
}
