import { expect, test } from 'bun:test';
import { execAlloy } from '@pkgs/alloy-server-ts/alloy-cli';
import { auditSnapshots } from '@pkgs/alloy-server-ts/audit';
import { commandVerdict } from '@pkgs/alloy-shared-ts/receipt';

const SOURCE = `sig Seat {}
one sig Group { seats: set Seat }
fact { #Group.seats <= 16 }
run Legal { #Group.seats = 16 } for 16 but 6 Int expect 1
run TooLarge { #Group.seats = 17 } for 17 but 6 Int expect 0
`;

// regression: alloy-expect-zero-receipt
test('the actual CLI preserves an expected absence of a world', () => {
  const result = execAlloy({ source: SOURCE, name: 'integer-scope' });
  expect(result.commands.map((command) => command.expects)).toEqual([1, 0]);
  expect(
    result.commands.map((command) => commandVerdict(command).pass)
  ).toEqual([true, true]);
}, 60_000);

// regression: alloy-snapshot-integer-scope
test('snapshot runs retain the declared integer scope and reject the seventeenth seat', async () => {
  const snapshots = [3, 16, 17].map((count) => {
    const seats = Array.from({ length: count }, (_, index) => `seat-${index}`);
    return {
      label: `${count} seats`,
      atoms: { Seat: seats, Group: ['group'] },
      relations: { seats: seats.map((seat) => ['group', seat]) },
    };
  });
  const verdicts = await auditSnapshots({ modelSource: SOURCE, snapshots });
  expect(verdicts.map((verdict) => verdict.legal)).toEqual([true, true, false]);
}, 60_000);
