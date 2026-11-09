import { expect, spyOn, test } from 'bun:test';
import * as board from '@libs/light-cycles-client-ts/light-cycles-board-view';
import { lightCyclesFrame } from '@libs/light-cycles-client-ts/light-cycles-frame';
import { LIGHT_CYCLES_SEATS } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';

// regression: light-cycles-frame-repeated-position-decode
test('Quad frame readers validate one shared position once and invalidate it on every changed position', () => {
  const frame = lightCyclesFrame(4);
  const codec = lightCyclesPositionCodec(4);
  const first = codec.encode(lightCyclesStart(4, 3));
  const second = codec.encode(lightCyclesStart(4, 1));
  const decode = spyOn(board, 'decodeLightCycles');
  try {
    for (const side of LIGHT_CYCLES_SEATS[4]) {
      expect(frame.seats.stat(first, side)?.value).toBe('0');
      expect(frame.seats.out(first, side)).toBe(false);
    }
    expect(frame.turnStatus(first, 'white', [], () => null)).toContain(
      'first to 3'
    );
    expect(decode).toHaveBeenCalledTimes(1);
    expect(frame.turnStatus(second, 'white', [], () => null)).toContain(
      'first to 1'
    );
    expect(decode).toHaveBeenCalledTimes(2);
    expect(frame.turnStatus('invalid', 'white', [], () => null)).toBeNull();
    expect(frame.seats.out('invalid', 'white')).toBe(false);
    expect(decode).toHaveBeenCalledTimes(3);
    expect(frame.turnStatus(first, 'white', [], () => null)).toContain(
      'first to 3'
    );
    expect(decode).toHaveBeenCalledTimes(4);
  } finally {
    decode.mockRestore();
  }
});
