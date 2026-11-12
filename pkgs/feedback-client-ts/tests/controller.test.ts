import { describe, expect, test } from 'bun:test';
import { MAX_SCREENSHOTS } from '@pkgs/feedback-shared-ts/bug-report';
import { RETRY_MS, SCREENSHOT_DEADLINE_MS } from '../src/controller';
import { chosen, createDevice, PNG, settle } from './support';

describe('pictures on a bug report', () => {
  // regression: feedback-concurrent-attachments
  test('pictures added at once never pass the limit', async () => {
    const device = createDevice();
    await device.controller.open();
    const adding = [1, 2, 3, 4].map(() =>
      device.controller.addPicture(chosen())
    );
    expect(device.controller.state().notice).toBe('too-many');
    await Promise.all(adding);
    expect(device.controller.state().screenshots).toHaveLength(MAX_SCREENSHOTS);
    expect(device.controller.state().adding).toBe(0);
  });

  // regression: feedback-attachment-send-race
  test('sending waits for a picture still being saved', async () => {
    const device = createDevice();
    await device.controller.open();
    device.controller.describe('The board froze');
    let finishReading: (bytes: Uint8Array) => void = () => undefined;
    const slow = new Promise<Uint8Array>((resolve) => {
      finishReading = resolve;
    });
    void device.controller.addPicture(chosen(PNG, () => slow));
    const sending = device.controller.send();
    await settle();
    expect(device.sent).toHaveLength(0);
    finishReading(PNG);
    await sending;
    expect(device.sent[0]?.pictures).toHaveLength(2);
    expect(device.controller.state().notice).toBe('sent');
  });

  test('a file that only claims to be a picture is refused', async () => {
    const device = createDevice();
    await device.controller.open();
    await device.controller.addPicture(
      chosen(new TextEncoder().encode('<script>alert(1)</script>'))
    );
    expect(device.controller.state().notice).toBe('not-a-picture');
    expect(device.controller.state().screenshots).toHaveLength(1);
  });

  test('a screenshot that never arrives does not keep the bug report shut', async () => {
    const device = createDevice();
    device.capture = () => new Promise(() => undefined);
    await device.controller.ready;
    const opening = device.controller.open();
    await settle();
    expect(device.controller.state().open).toBe(false);
    device.clock.advance(SCREENSHOT_DEADLINE_MS);
    await opening;
    expect(device.controller.state().open).toBe(true);
    expect(device.controller.state().screenshots).toHaveLength(0);
  });
});

describe('a bug report the team could not be reached for', () => {
  async function sendUnanswered(device: ReturnType<typeof createDevice>) {
    device.answer = 'later';
    await device.controller.open();
    device.controller.describe('The board froze');
    await device.controller.send();
    await device.controller.settled();
  }

  test('is kept and sent again as the same bug report', async () => {
    const device = createDevice();
    await sendUnanswered(device);
    expect(device.controller.state().waiting).toBe(1);
    expect(device.controller.state().notice).toBe('later');
    device.answer = 'sent';
    device.clock.advance(RETRY_MS);
    await settle();
    await device.controller.settled();
    expect(device.controller.state().waiting).toBe(0);
    expect(device.sent).toHaveLength(2);
    expect(device.sent[1]?.submission.id).toBe(device.sent[0]?.submission.id);
    expect(device.sent[1]?.pictures).toHaveLength(1);
  });

  // regression: feedback-reload-repeats-submission
  test('is sent as the same bug report after the app is opened again', async () => {
    const device = createDevice();
    await sendUnanswered(device);
    const reopened = createDevice(device.store);
    await reopened.controller.ready;
    await settle();
    await reopened.controller.settled();
    expect(reopened.sent.map((sent) => sent.submission.id)).toEqual([
      device.sent[0]?.submission.id ?? '',
    ]);
    expect(reopened.controller.state().waiting).toBe(0);
  });

  test('is tried less often while the team stays out of reach', async () => {
    const device = createDevice();
    await sendUnanswered(device);
    device.clock.advance(RETRY_MS);
    await settle();
    await device.controller.settled();
    expect(device.sent).toHaveLength(2);
    device.clock.advance(RETRY_MS);
    await settle();
    await device.controller.settled();
    expect(device.sent).toHaveLength(2);
    device.clock.advance(RETRY_MS);
    await settle();
    await device.controller.settled();
    expect(device.sent).toHaveLength(3);
  });

  test('gives way to the bug reports kept before it', async () => {
    const device = createDevice();
    await sendUnanswered(device);
    device.controller.close();
    await device.controller.open();
    device.controller.describe('The hint never appeared');
    await device.controller.send();
    await device.controller.settled();
    expect(device.controller.state().waiting).toBe(2);
    device.answer = 'sent';
    device.clock.advance(RETRY_MS);
    await settle();
    await device.controller.settled();
    expect(device.controller.state().waiting).toBe(0);
    expect(
      device.sent.slice(-2).map((sent) => sent.submission.description)
    ).toEqual(['The board froze', 'The hint never appeared']);
  });
});

describe('a bug report sent past the daily limit', () => {
  const HOUR_MS = 60 * RETRY_MS;

  test('is kept, and reaches the team once the next day starts', async () => {
    const device = createDevice();
    device.answer = 'limit';
    await device.controller.open();
    device.controller.describe('The board froze');
    await device.controller.send();
    await device.controller.settled();
    expect(device.controller.state()).toMatchObject({
      phase: 'done',
      notice: 'limit',
      waiting: 1,
      description: '',
    });
    // The team would take it at any moment; the device still waits for the day.
    device.answer = 'sent';
    const day = new Date(device.clock.now()).getUTCDate();
    const nextHourIsToday = () =>
      new Date(device.clock.now() + HOUR_MS).getUTCDate() === day;
    while (nextHourIsToday()) {
      device.clock.advance(HOUR_MS);
      await settle();
      await device.controller.settled();
    }
    expect(device.sent).toHaveLength(1);
    expect(device.controller.state().waiting).toBe(1);
    device.clock.advance(2 * HOUR_MS);
    await settle();
    await device.controller.settled();
    expect(device.sent).toHaveLength(2);
    expect(device.controller.state().waiting).toBe(0);
    expect(device.sent.at(-1)?.submission.id).toBe(
      device.sent[0]?.submission.id
    );
  });
});

describe('a draft', () => {
  test('survives the app being opened again', async () => {
    const device = createDevice();
    await device.controller.open();
    device.controller.describe('Half a thought');
    await device.controller.settled();
    const reopened = createDevice(device.store);
    await reopened.controller.ready;
    expect(reopened.controller.state().description).toBe('Half a thought');
  });

  test('is gone from the device once discarded', async () => {
    const device = createDevice();
    await device.controller.open();
    device.controller.describe('Half a thought');
    await device.controller.addPicture(chosen());
    await device.controller.discard();
    expect(device.controller.state()).toMatchObject({
      open: false,
      description: '',
      screenshots: [],
    });
    expect(await device.store.listKeys('')).toEqual([]);
    const reopened = createDevice(device.store);
    await reopened.controller.ready;
    expect(reopened.controller.state().description).toBe('');
    expect(reopened.sent).toHaveLength(0);
  });

  test('is not sent without a description', async () => {
    const device = createDevice();
    await device.controller.open();
    device.controller.describe('   ');
    await device.controller.send();
    expect(device.sent).toHaveLength(0);
    expect(device.controller.state().notice).toBe('describe');
  });
});
