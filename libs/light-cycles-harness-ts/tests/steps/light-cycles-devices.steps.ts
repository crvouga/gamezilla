import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type {
  LightCyclesDirection,
  LightCyclesRiderName,
} from '@libs/light-cycles-harness-ts/light-cycles-board-view';
import {
  deviceOf,
  switchDevices,
} from '@libs/light-cycles-harness-ts/light-cycles-devices';
import { steerLightCyclesRider } from '@libs/light-cycles-harness-ts/light-cycles-person-steering';
import { steeringShown } from '@libs/light-cycles-harness-ts/light-cycles-reads';

/** The time a device takes to show the game it has just opened. */
const CAUGHT_UP_MS = 5000;

Given('{actor} has switched devices', (w, person: string) =>
  w.s.apply(switchDevices, person)
);
When('{actor} switches devices', (w, person: string) =>
  w.s.apply(switchDevices, person)
);
When(
  '{actor} steers {lightCyclesRider} {lightCyclesHeading} from her first device',
  (
    w,
    person: string,
    rider: LightCyclesRiderName,
    heading: LightCyclesDirection
  ) =>
    w.s.apply(steerLightCyclesRider, {
      rider,
      heading,
      device: deviceOf(person, 'first'),
    })
);

Then(
  '{actor} can steer {lightCyclesRider} from her other device',
  async (w, person: string, rider: LightCyclesRiderName) => {
    const device = deviceOf(person, 'other');
    const shown = await w.s.until((s) => steeringShown(s, device, rider), {
      maxMs: CAUGHT_UP_MS,
      pred: (steering) => steering.offered,
    });
    expect(shown.status).toMatch(/^(riding|countdown)$/);
  }
);
Then(
  '{actor} can steer {lightCyclesRider} from her first device',
  async (w, person: string, rider: LightCyclesRiderName) => {
    const device = deviceOf(person, 'first');
    const shown = await w.s.until((s) => steeringShown(s, device, rider), {
      maxMs: CAUGHT_UP_MS,
      pred: (steering) => steering.offered,
    });
    expect(shown.status).toMatch(/^(riding|countdown)$/);
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} from her first device because she rides from her other device',
  async (w, person: string, rider: LightCyclesRiderName) => {
    const device = deviceOf(person, 'first');
    const shown = await w.s.until((s) => steeringShown(s, device, rider), {
      maxMs: CAUGHT_UP_MS,
      pred: (steering) => steering.status === 'elsewhere',
    });
    expect(shown).toEqual({ offered: false, status: 'elsewhere' });
  }
);
Then(
  '{actor} cannot steer {lightCyclesRider} from her other device because her practice stays on her first device',
  async (w, person: string, rider: LightCyclesRiderName) => {
    const device = deviceOf(person, 'other');
    const shown = await w.s.until((s) => steeringShown(s, device, rider), {
      maxMs: CAUGHT_UP_MS,
      pred: (steering) => steering.status === 'elsewhere',
    });
    expect(shown).toEqual({ offered: false, status: 'elsewhere' });
  }
);
