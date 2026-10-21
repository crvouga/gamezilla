import type { Activity } from '@libs/synthetic-population-shared-ts/config';
import type { Counter, Histogram } from '@opentelemetry/api';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import type { SessionInput, SessionOutput } from './session-messages';

export type RealmMeasurements = { online: boolean; activity: Activity };
type RealmMeasurementPorts = {
  clock: Clock;
  realms: Set<RealmMeasurements>;
  instruments: {
    authenticationFailures: Counter | undefined;
    actionFailures: Counter | undefined;
    recoveries: Counter | undefined;
    recoveryDuration: Histogram | undefined;
    authenticationDuration: Histogram | undefined;
    actionDuration: Histogram | undefined;
  };
};

function realmObserver(ports: RealmMeasurementPorts, state: RealmMeasurements) {
  let authenticatingAt = ports.clock.now();
  let recoveringAt: number | null = null;
  const secondsSince = (since: number) =>
    Math.max(0, ports.clock.now() - since) / 1000;
  return {
    input(value: SessionInput) {
      if (value.type === 'start') authenticatingAt = ports.clock.now();
      if (value.type === 'activate') state.online = true;
    },
    output(value: SessionOutput) {
      const instruments = ports.instruments;
      if (value.type === 'authenticated')
        instruments.authenticationDuration?.record(
          secondsSince(authenticatingAt)
        );
      if (value.type === 'checkpoint')
        state.activity = value.checkpoint.activity;
      if (value.type !== 'event') return;
      const event = value.event;
      if (event.name === 'AuthenticationFailed')
        instruments.authenticationFailures?.add(1);
      if (event.name === 'RecoveryStarted') {
        instruments.recoveries?.add(1);
        recoveringAt = ports.clock.now();
      }
      if (event.name === 'SessionRestored' && recoveringAt !== null) {
        instruments.recoveryDuration?.record(secondsSince(recoveringAt));
        recoveringAt = null;
      }
      if (
        event.name === 'UiDriverAction' &&
        event.context['outcome'] === 'failed'
      )
        instruments.actionFailures?.add(1);
      const duration = event.context['durationMs'];
      if (event.name === 'UiDriverAction' && typeof duration === 'number')
        instruments.actionDuration?.record(duration / 1000);
    },
  };
}

/** Observe lifecycle messages only; no DOM, credential or identity is retained. */
export function instrumentRealm(ports: RealmMeasurementPorts) {
  return (realm: IsolatedWorker): IsolatedWorker => {
    const state: RealmMeasurements = {
      online: false,
      activity: 'authenticating',
    };
    ports.realms.add(state);
    const observe = realmObserver(ports, state);
    return {
      post(value) {
        observe.input(value as SessionInput);
        realm.post(value);
      },
      subscribe(listener) {
        return realm.subscribe((value) => {
          observe.output(value as SessionOutput);
          listener(value);
        });
      },
      onError: (listener) => realm.onError(listener),
      terminate() {
        ports.realms.delete(state);
        realm.terminate();
      },
    };
  };
}
