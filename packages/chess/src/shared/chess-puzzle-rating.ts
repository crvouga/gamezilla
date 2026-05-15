/** Glicko-2 scale factor (rating → μ). */
const GLICKO_SCALE = 173.7178;

/** System constant τ — controls volatility change per period. */
const TAU = 0.5;

const PI_SQ = Math.PI ** 2;

/** Fixed opponent RD for puzzle rows (Lichess-style puzzle rating). */
const PUZZLE_OPPONENT_RD = 50;

export type PuzzleRatingScore = 0 | 0.5 | 1;

export type PuzzleRatingInput = {
  readonly playerRating: number;
  readonly playerRd: number;
  readonly puzzleRating: number;
  readonly score: PuzzleRatingScore;
};

export type PuzzleRatingResult = {
  readonly rating: number;
  readonly ratingDeviation: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function toMu(rating: number): number {
  return (rating - 1500) / GLICKO_SCALE;
}

function fromMu(mu: number): number {
  return 1500 + GLICKO_SCALE * mu;
}

function toPhi(rd: number): number {
  return rd / GLICKO_SCALE;
}

function fromPhi(phi: number): number {
  return GLICKO_SCALE * phi;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi ** 2) / PI_SQ);
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function volatilityObjective(args: {
  x: number;
  delta: number;
  phi: number;
  v: number;
  a: number;
}): number {
  const { x, delta, phi, v, a } = args;
  const ex = Math.exp(x);
  const num = ex * (delta ** 2 - phi ** 2 - v - ex);
  const den = 2 * (phi ** 2 + v + ex) ** 2;
  return num / den - (x - a) / TAU ** 2;
}

/** Iterative Glicko-2 volatility update (Mark Glickman's algorithm). */
function newVolatility(phi: number, delta: number, v: number): number {
  const a = Math.log(phi ** 2);
  let A = a;
  if (delta ** 2 > phi ** 2 + v) {
    A = Math.log(delta ** 2 - phi ** 2 - v);
  }
  let B: number;
  if (delta ** 2 > phi ** 2 + v) {
    B = A;
  } else {
    let k = 1;
    while (
      volatilityObjective({
        x: a - k * TAU,
        delta,
        phi,
        v,
        a,
      }) < 0
    ) {
      k += 1;
    }
    B = a - k * TAU;
  }
  let fA = volatilityObjective({ x: A, delta, phi, v, a });
  let fB = volatilityObjective({ x: B, delta, phi, v, a });
  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = volatilityObjective({ x: C, delta, phi, v, a });
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/**
 * Glicko-2 rating update for a single puzzle outcome.
 * `score`: 1 = clean solve, 0.5 = solved with hint/wrong move, 0 = abandoned.
 */
export function updatePuzzleRating(
  input: PuzzleRatingInput
): PuzzleRatingResult {
  const mu = toMu(input.playerRating);
  const phi = toPhi(input.playerRd);
  const muJ = toMu(input.puzzleRating);
  const phiJ = toPhi(PUZZLE_OPPONENT_RD);

  const gVal = g(phiJ);
  const eVal = expectedScore(mu, muJ, phiJ);
  const v = 1 / (gVal ** 2 * eVal * (1 - eVal));
  const delta = v * gVal * (input.score - eVal);

  const phiStar = newVolatility(phi, delta, v);
  const phiPrime = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muPrime = mu + phiPrime ** 2 * delta;

  return {
    rating: clamp(Math.round(fromMu(muPrime)), 400, 3000),
    ratingDeviation: clamp(Math.round(fromPhi(phiPrime)), 30, 350),
  };
}
