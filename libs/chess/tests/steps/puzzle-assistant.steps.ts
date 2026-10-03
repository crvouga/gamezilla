import { expect } from 'bun:test';
import { playPuzzleMove } from '@libs/chess/harness/chess-actions';
import { isPuzzleBoardInteractive } from '@libs/chess/harness/chess-puzzle-solve-ui';
import {
  failAssistantAudio,
  mutePuzzleAssistant,
  preferReducedMotion,
  readAssistantAudioFailures,
  readAssistantAudioPlaying,
  readAssistantAudioState,
  readPuzzleAssistant,
  readReducedMotionApplied,
  stepPuzzlePosition,
  unmutePuzzleAssistant,
} from '@libs/chess/harness/puzzle-assistant-ui';
import { deliverCompetingPuzzleMates } from '@libs/chess/harness/puzzle-competing-mates';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import { cutConnection, otherDevice } from '@libs/harness/spec/steps/platform';
import { remember } from '@libs/harness/spec/world';
import { ASSISTANT_PUZZLES } from './assistant-fixtures';
import {
  enterNamedPuzzle,
  recalled,
  required,
  SETTLE_MS,
  waitSolverToMove,
} from './puzzle-world';

async function shown(w: HarnessWorld, actor: Actor) {
  await w.s.until((s) => readPuzzleAssistant(s, actor), {
    maxMs: SETTLE_MS,
    pred: (value) => (value?.text.length ?? 0) > 0,
  });
  return required(
    await w.s.read(readPuzzleAssistant, actor),
    'readable assistant'
  );
}

function named(name: keyof typeof ASSISTANT_PUZZLES, wrong: string) {
  return async (w: HarnessWorld, actor: Actor) => {
    await enterNamedPuzzle(w, actor, ASSISTANT_PUZZLES[name]);
    remember(w, `coachWrong:${actor}`, wrong);
  };
}
Given(
  '{actor} is solving the puzzle with an exposed knight',
  named('exposed', 'g1h1')
);
Given(
  '{actor} is solving the puzzle with a defended knight',
  named('defended', 'g1h1')
);
Given(
  '{actor} is solving the puzzle with a knight fork threat',
  named('fork', 'h2h3')
);
Given(
  '{actor} is solving the castling puzzle labelled as a fork',
  named('falseFork', 'h1h2')
);
Given(
  "{actor}'s puzzle offers checkmate and a wrong move exposes a knight",
  named('mate', 'g1f1')
);

Given(
  "{actor}'s puzzle starts in check with a hanging piece",
  (w, actor: Actor) => {
    remember(w, `coachPuzzle:${actor}`, ASSISTANT_PUZZLES.checked);
  }
);
When('{actor} opens that puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, recalled(w, `coachPuzzle:${actor}`));
});
async function quietWrong(w: HarnessWorld, actor: Actor) {
  await waitSolverToMove(w, actor);
  await w.s.apply(
    playPuzzleMove,
    actor,
    recalled<string>(w, `coachWrong:${actor}`)
  );
}
When('{actor} plays the quiet wrong move', quietWrong);
When('{actor} plays a wrong move exposing the knight', quietWrong);

function kind(expected: string) {
  return async (w: HarnessWorld, actor: Actor) => {
    await w.s.until((s) => readPuzzleAssistant(s, actor), {
      maxMs: SETTLE_MS,
      pred: (value) => value?.kind === expected,
    });
    expect((await shown(w, actor)).kind).toBe(expected);
  };
}
Then(
  "{actor}'s assistant acknowledges a correct continuation",
  kind('progress')
);
Then("{actor}'s assistant acknowledges checkmate", kind('checkmate'));
Then(
  "{actor}'s assistant draws attention to an available checkmate",
  kind('missed mate')
);
Then(
  "{actor}'s assistant explains that the king must escape check",
  kind('check')
);
Then(
  "{actor}'s assistant explains the highlighted solution piece",
  kind('hint')
);
Then(
  "{actor}'s assistant explains that the solution is shown",
  kind('revealed')
);
Then(
  "{actor}'s assistant encourages another look at the current position",
  kind('ready')
);
Then("{actor}'s assistant introduces the current puzzle", kind('ready'));
Then(
  "{actor}'s assistant explains that they are reviewing an earlier position",
  kind('review')
);
Then(
  "{actor}'s assistant cannot diagnose a move from another position",
  excludes(['wrong', 'missed mate', 'hanging piece', 'knight fork', 'check'])
);

async function earlierPosition(w: HarnessWorld, actor: Actor) {
  await w.s.apply(stepPuzzlePosition, actor, 'back');
}
Given(
  '{actor} is reviewing an earlier position in the puzzle',
  earlierPosition
);
When('{actor} steps back one move in the puzzle', earlierPosition);
When('{actor} returns to the current puzzle move', async (w, actor: Actor) => {
  await w.s.apply(stepPuzzlePosition, actor, 'forward');
});

Then(
  "{actor}'s assistant acknowledges the current solved puzzle",
  async (w, actor: Actor) => {
    const message = await shown(w, actor);
    expect(message.purpose).toBe('solved');
  }
);
Then(
  "{actor}'s assistant explains that the knight could be captured without a recapture",
  async (w, actor: Actor) => {
    const message = await shown(w, actor);
    expect(message.kind).toBe('hanging piece');
    expect(message.text).toContain('knight on d2');
    expect(message.text).toContain('without a recapture');
  }
);
Then(
  "{actor}'s assistant explains the knight fork of king and queen",
  async (w, actor: Actor) => {
    const message = await shown(w, actor);
    expect(message.kind).toBe('knight fork');
    expect(message.text).toContain('e3');
    expect(message.text).toContain('king on f1');
    expect(message.text).toContain('queen on d1');
  }
);
function excludes(kinds: readonly string[]) {
  return async (w: HarnessWorld, actor: Actor) => {
    expect(kinds).not.toContain((await shown(w, actor)).kind);
  };
}
Then(
  "{actor}'s assistant cannot call the move wrong",
  excludes(['wrong', 'missed mate', 'hanging piece', 'knight fork'])
);
Then(
  "{actor}'s assistant cannot praise a solved puzzle",
  excludes(['solved', 'checkmate'])
);
Then(
  "{actor}'s assistant cannot claim a hanging knight",
  excludes(['hanging piece'])
);
Then("{actor}'s assistant cannot claim a fork", excludes(['knight fork']));
Then(
  "{actor}'s assistant cannot present the old wrong-move diagnosis",
  excludes(['wrong', 'missed mate', 'hanging piece', 'knight fork'])
);
Then(
  "{actor}'s assistant cannot present the old success commentary",
  excludes(['solved', 'checkmate'])
);

When('{actor} mutes the Puzzle Assistant', async (w, actor: Actor) => {
  await w.s.apply(mutePuzzleAssistant, actor);
});
Then(
  "{actor} can read the assistant's current observation",
  async (w, actor: Actor) => {
    expect((await shown(w, actor)).text.trim().length).toBeGreaterThan(0);
  }
);
Then('{actor} can move pieces', async (w, actor: Actor) => {
  await waitSolverToMove(w, actor);
  expect(await w.s.read(isPuzzleBoardInteractive, actor)).toBe(true);
});
async function silent(w: HarnessWorld, actor: Actor) {
  expect(await w.s.read(readAssistantAudioPlaying, actor)).toBe(false);
}
Then('{actor} cannot hear the assistant speaking', silent);
Then("{actor} cannot hear the old puzzle's assistant speaking", silent);
Given("{actor}'s audio is unavailable", async (w, actor: Actor) => {
  await w.s.apply(failAssistantAudio, actor);
});
Then(
  "{actor}'s assistant stays readable when speech cannot play",
  async (w, actor: Actor) => {
    expect(await w.s.read(readAssistantAudioFailures, actor)).toBeGreaterThan(
      0
    );
    expect((await shown(w, actor)).text.trim().length).toBeGreaterThan(0);
  }
);
Then(
  "{actor}'s assistant stays readable with reduced motion",
  async (w, actor: Actor) => {
    expect(await w.s.read(readReducedMotionApplied, actor)).toBe(true);
    expect((await shown(w, actor)).text.trim().length).toBeGreaterThan(0);
  }
);
Given("{actor}'s assistant is speaking", async (w, actor: Actor) => {
  await w.s.until((s) => readAssistantAudioState(s, actor), {
    maxMs: SETTLE_MS,
    pred: (state) =>
      state.some((player) => {
        const source = player.source as { uri?: string } | undefined;
        return (
          (source?.uri?.includes('/tts/audio/') === true ||
            source?.uri?.startsWith('blob:') === true) &&
          player.status.playing
        );
      }),
  });
  expect((await shown(w, actor)).speaking).toBe(true);
});
Given(
  '{actor} has delivered the alternate checkmate offline',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await waitSolverToMove(w, actor);
    await w.s.apply(playPuzzleMove, actor, 'a7a8');
  }
);

Given(
  '{actor} has delivered different valid checkmates on both devices offline',
  async (w, actor: Actor) => {
    await w.s.apply(deliverCompetingPuzzleMates, actor, otherDevice(actor));
  }
);

Given('{actor} prefers reduced motion', async (w, actor: Actor) => {
  await w.s.apply(preferReducedMotion, actor);
});

Given('{actor} has muted the Puzzle Assistant', async (w, actor: Actor) => {
  await w.s.apply(mutePuzzleAssistant, actor);
});
When('{actor} unmutes the Puzzle Assistant', async (w, actor: Actor) => {
  await w.s.apply(unmutePuzzleAssistant, actor);
});
Then('{actor} can hear the assistant speaking', async (w, actor: Actor) => {
  await w.s.until((s) => readAssistantAudioPlaying(s, actor), {
    maxMs: SETTLE_MS,
  });
});
