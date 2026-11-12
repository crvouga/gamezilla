/** @jsxImportSource solid-js */

import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Switch as Toggle } from '@pkgs/ui-root-client-ts/switch';
import { Show } from 'solid-js';
import { SHAKE_REFUSED } from './copy';
import type { ShakeControl, ShakeState } from './shake';
import { useShakeState } from './use-bug-reports';

export type ShakeSettingViewProps = {
  state: ShakeState;
  onChange: (on: boolean) => void;
};

/**
 * The one setting of bug reporting. A device that cannot feel a shake shows
 * nothing; a phone that refused says how to report a bug without shaking.
 */
export function ShakeSettingView(props: ShakeSettingViewProps) {
  return (
    <Show when={props.state !== 'unavailable'}>
      <StackVertical gap="xs" testId="shake-setting">
        <Toggle
          label="Shake to report a bug"
          value={props.state === 'on'}
          onValueChange={(on) => props.onChange(on)}
          dataSet={{ testid: 'shake-setting-switch' }}
        />
        <Show when={props.state === 'refused'}>
          <Notice tone="warning" dataSet={{ testid: 'shake-setting-refused' }}>
            {SHAKE_REFUSED}
          </Notice>
        </Show>
      </StackVertical>
    </Show>
  );
}

/** Wires `ShakeSettingView` to the device: turning it on is where a phone asks. */
export function ShakeSetting(props: { shake: ShakeControl }) {
  const state = useShakeState(() => props.shake);
  return (
    <ShakeSettingView
      state={state()}
      onChange={(on) =>
        void (on ? props.shake.turnOn() : props.shake.turnOff())
      }
    />
  );
}
