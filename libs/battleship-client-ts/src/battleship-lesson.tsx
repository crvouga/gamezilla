import {
  battleshipRules,
  resolveBattleshipShot,
} from '@libs/battleship-shared-ts/battleship-rules';
import {
  type GameLesson,
  practiceBoard,
} from '@libs/game-menu-client-ts/game-lesson';
import { t } from '@lingui/core/macro';
import { BattleshipBoard } from './battleship-board';

const fleets = {
  white:
    'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h',
  black:
    'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@f8h;destroyer@f10h',
};
const Board = practiceBoard(BattleshipBoard, { setup: fleets.white });
function shoot(target: string) {
  return (position: string, cell: string) => {
    if (cell !== target) return null;
    const shot = resolveBattleshipShot(position, cell, fleets);
    return (
      shot && (battleshipRules.play(position, shot, '', [])?.position ?? null)
    );
  };
}
export const battleshipLesson: GameLesson = [
  {
    Board,
    initial: battleshipRules.initial,
    play: shoot('f10'),
    prompt: () =>
      t`Aim at F10 in opposing waters, then choose Fire to reveal what is there.`,
    success: () =>
      t`A hit! Part of a ship is at F10. The rest is still hidden.`,
  },
  {
    Board,
    initial: () => battleshipRules.replay(['f10:hit', 'a2:miss'], 2),
    play: shoot('g10'),
    prompt: () => t`Your opponent missed. Try G10 beside your hit, then fire.`,
    success: () =>
      t`You hit both squares of the destroyer and sank it. Sink the whole fleet to win.`,
  },
];
