/**
 * G-competition template (aspirational).
 *
 * Stakes chess is not in product yet. When a competition RoomModule lands,
 * replace this skip with real DST races mapping to Gc4–Gc6 (flag vs move,
 * resign vs mate, draw-accept vs move). Do not re-prove engine E1–E9 here.
 */
import { describe, test } from 'bun:test';

describe('chess competition races (Gc template)', () => {
  test.skip('flag-fall vs move-in-flight → single terminal (Gc4)', () => {
    // Await stakes RoomModule with clocks.
  });

  test.skip('resign vs mate-in-flight → single terminal (Gc5)', () => {
    // Await stakes RoomModule with resign + mate detection.
  });

  test.skip('draw-accept vs move → one outcome (Gc6)', () => {
    // Await stakes RoomModule with draw-offer state machine.
  });
});
