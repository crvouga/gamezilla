/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Switch as Toggle } from '@pkgs/ui-root-client-ts/switch';
import { Show } from 'solid-js';
import { SHAKE_ALLOW, SHAKE_REFUSED, SHAKE_WAITING } from './copy';
import type { ShakeControl, ShakeState } from './shake';
import { useShakeState } from './use-bug-reports';

export type ShakeSettingViewProps = {
  state: ShakeState;
  onChange: (on: boolean) => void;
  /** The person asks the phone to ask them. */
  onAllow: () => void;
};

/**
 * The one setting of bug reporting, on unless the person turned it off. A
 * device that cannot feel a shake shows nothing; a phone that asks first
 * offers to be asked; a phone that refused says how to report a bug without
 * shaking.
 */
export function ShakeSettingView(props: ShakeSettingViewProps) {
  return (
    <Show when={props.state !== 'unavailable'}>
      <StackVertical gap="xs" testId="shake-setting">
        <Toggle
          label="Shake to report a bug"
          value={props.state !== 'off'}
          onValueChange={(on) => props.onChange(on)}
          dataSet={{ testid: 'shake-setting-switch' }}
        />
        <Show when={props.state === 'needs-permission'}>
          <Notice dataSet={{ testid: 'shake-setting-waiting' }}>
            {SHAKE_WAITING}
          </Notice>
          <Button
            title={SHAKE_ALLOW}
            variant="outline"
            size="sm"
            onClick={() => props.onAllow()}
            dataSet={{ testid: 'shake-setting-allow' }}
          />
        </Show>
        <Show when={props.state === 'refused'}>
          <Notice tone="warning" dataSet={{ testid: 'shake-setting-refused' }}>
            {SHAKE_REFUSED}
          </Notice>
        </Show>
      </StackVertical>
    </Show>
  );
}

/** Wires `ShakeSettingView` to the device: a phone asks when the person allows it or turns it on. */
export function ShakeSetting(props: { shake: ShakeControl }) {
  const state = useShakeState(() => props.shake);
  return (
    <ShakeSettingView
      state={state()}
      onChange={(on) =>
        void (on ? props.shake.turnOn() : props.shake.turnOff())
      }
      onAllow={() => void props.shake.allow()}
    />
  );
}
