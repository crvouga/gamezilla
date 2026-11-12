import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import type { MotionSample } from '../src/ports';
import { ShakeControl } from '../src/shake';
import { BugReportStorage } from '../src/storage';
import { settle } from './support';

const SAMPLE_MS = 50;

/** A phone that asks before an app may notice shaking, and the app on it. */
function createPhone(store = new ObjectStoreImplInMemory()) {
  const { clock } = createHarnessClock();
  const feeling = new Set<(sample: MotionSample) => void>();
  const phone = {
    store,
    opened: 0,
    asksFirst: true,
    /** What the person answered the phone, once they have. */
    answer: null as boolean | null,
    /** Answers of the phone the person has yet to give. */
    asking: [] as ((allowed: boolean) => void)[],
  };
  const shake = new ShakeControl({
    motion: {
      available: true,
      get needsPermission() {
        return phone.asksFirst;
      },
      requestPermission: () =>
        phone.answer === null
          ? new Promise((resolve) => phone.asking.push(resolve))
          : Promise.resolve(phone.answer),
      subscribe(listener) {
        feeling.add(listener);
        return () => feeling.delete(listener);
      },
    },
    storage: new BugReportStorage(store, () => 'id'),
    clock,
    onShake: () => {
      phone.opened++;
    },
  });
  return Object.assign(phone, {
    shake,
    decide(allowed: boolean): void {
      phone.answer = allowed;
      for (const tell of phone.asking.splice(0)) tell(allowed);
    },
    shakeIt(): void {
      for (let sample = 0; sample < 12; sample++) {
        const x = sample % 2 === 0 ? 30 : -30;
        for (const listener of feeling) listener({ x, y: 0, z: 9.8 });
        clock.advance(SAMPLE_MS);
      }
    },
  });
}

describe('shake to report on a phone that asks first', () => {
  test('is on and waits for the person, and a shake opens nothing yet', async () => {
    const phone = createPhone();
    await phone.shake.ready;
    expect(phone.shake.state()).toBe('needs-permission');
    phone.shakeIt();
    expect(phone.opened).toBe(0);
  });

  test('opens a bug report on a shake once the person allows it', async () => {
    const phone = createPhone();
    const allowing = phone.shake.allow();
    phone.decide(true);
    await allowing;
    expect(phone.shake.state()).toBe('on');
    phone.shakeIt();
    expect(phone.opened).toBe(1);
  });

  test('stays on, and says so, when the person refuses', async () => {
    const phone = createPhone();
    const allowing = phone.shake.allow();
    phone.decide(false);
    await allowing;
    expect(phone.shake.state()).toBe('refused');
    phone.shakeIt();
    expect(phone.opened).toBe(0);
  });

  test('turned back on is on at once, while the phone still waits for its answer', async () => {
    const phone = createPhone();
    await phone.shake.turnOff();
    expect(phone.shake.state()).toBe('off');
    const turningOn = phone.shake.turnOn();
    await settle();
    expect(phone.shake.state()).toBe('needs-permission');
    phone.decide(true);
    await turningOn;
    expect(phone.shake.state()).toBe('on');
  });

  test('turned off stays off when the phone is allowed afterwards', async () => {
    const phone = createPhone();
    await phone.shake.ready;
    const turningOn = phone.shake.turnOn();
    await settle();
    await phone.shake.turnOff();
    phone.decide(true);
    await turningOn;
    expect(phone.shake.state()).toBe('off');
    phone.shakeIt();
    expect(phone.opened).toBe(0);
    await phone.shake.turnOn();
    phone.shakeIt();
    expect(phone.opened).toBe(1);
  });

  test('allowed while off stays off', async () => {
    const phone = createPhone();
    await phone.shake.turnOff();
    const allowing = phone.shake.allow();
    phone.decide(true);
    await allowing;
    expect(phone.shake.state()).toBe('off');
  });

  test('stays as the person set it when the app is opened again', async () => {
    const phone = createPhone();
    const allowing = phone.shake.allow();
    phone.decide(true);
    await allowing;
    const reopened = createPhone(phone.store);
    reopened.answer = true;
    await reopened.shake.ready;
    expect(reopened.shake.state()).toBe('on');
    await reopened.shake.turnOff();
    const again = createPhone(phone.store);
    await again.shake.ready;
    expect(again.shake.state()).toBe('off');
  });
});

describe('shake to report on a phone that does not ask', () => {
  test('is on from the start', async () => {
    const phone = createPhone();
    phone.asksFirst = false;
    await phone.shake.ready;
    expect(phone.shake.state()).toBe('on');
    phone.shakeIt();
    expect(phone.opened).toBe(1);
  });
});
